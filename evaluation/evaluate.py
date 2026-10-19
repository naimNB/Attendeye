"""Reproducible CPU evaluation using the application's face and matching services."""
import argparse
import csv
import hashlib
import json
import platform
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.stats import norm
from scipy.optimize import linear_sum_assignment
from app.services.face_engine import get_face_engine, decode_image
from app.services.liveness import get_liveness_checker
from app.services.matching import score_matrix, match_faces
from metrics import rates, eer, recommend, safe_ratio, wilson_upper

CONDITIONS = ["bright", "dim", "backlit", "angle30", "angle45", "far", "glasses"]


def images(folder: Path) -> list[Path]:
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}) if folder.is_dir() else []


def require_images(folder: Path) -> list[Path]:
    found = images(folder)
    if not found: raise ValueError(f"Missing folder or no images: {folder}")
    return found


def one_face(path: Path, engine) -> tuple:
    start = time.perf_counter()
    image = decode_image(path.read_bytes())
    faces = engine.detect(image)
    elapsed = time.perf_counter() - start
    if len(faces) != 1: return image, None, f"face_count_{len(faces)}", elapsed
    return image, faces[0], ",".join(faces[0].quality_reasons), elapsed


def validate_layout(root: Path, enrolled_file: Path, spoof: Path, group: Path, labels: Path) -> tuple[list[str], list[Path], list[dict]]:
    if not root.is_dir(): raise ValueError(f"Dataset folder missing: {root}")
    if not enrolled_file.is_file(): raise ValueError(f"Enrolled-ID file missing: {enrolled_file}")
    enrolled = [line.strip() for line in enrolled_file.read_text().splitlines() if line.strip() and not line.startswith("#")]
    if len(set(enrolled)) < 2 or len(enrolled) != len(set(enrolled)):
        raise ValueError("Provide at least two unique enrolled person IDs")
    if any(Path(person).name != person or person in {".", ".."} for person in enrolled):
        raise ValueError("Person IDs must be simple directory names")
    people = sorted(p for p in root.iterdir() if p.is_dir())
    if not set(enrolled).issubset({p.name for p in people}): raise ValueError("An enrolled ID has no dataset directory")
    if not any(p.name not in enrolled for p in people): raise ValueError("Open-set test needs at least one person NOT listed in enrolled.txt")
    for person in people:
        if person.name in enrolled:
            count = len(require_images(person / "enrol"))
            if not 5 <= count <= 10: raise ValueError(f"{person.name}: supply 5..10 enrolment images")
        for condition in CONDITIONS:
            require_images(person / "probe" / condition)
    for kind in ["print", "screen"]: require_images(spoof / kind)
    require_images(group)
    if not labels.is_file(): raise ValueError(f"Group labels missing: {labels}")
    with labels.open(newline="", encoding="utf-8") as stream: group_rows = list(csv.DictReader(stream))
    if not group_rows or not {"image", "person_ids"}.issubset(group_rows[0]):
        raise ValueError("group_labels.csv requires image and person_ids columns")
    for row in group_rows:
        if Path(row["image"]).name != row["image"] or not (group / row["image"]).is_file():
            raise ValueError(f"Invalid/missing group image: {row['image']}")
        row["ids"] = [s.strip() for s in row["person_ids"].split(";") if s.strip()]
        if not row["ids"] or len(set(row["ids"])) != len(row["ids"]): raise ValueError("Group person_ids must be unique semicolon-separated IDs")
        if not set(row["ids"]).issubset({p.name for p in people}): raise ValueError("Unknown group label ID")
        row["boxes"] = json.loads(row["boxes_json"]) if row.get("boxes_json", "").strip() else None
        if row["boxes"] is not None and (len(row["boxes"]) != len(row["ids"]) or any(len(b) != 4 or b[2] <= b[0] or b[3] <= b[1] for b in row["boxes"])):
            raise ValueError("boxes_json must contain one valid [x1,y1,x2,y2] box per person ID")
    # Exact duplicates across enrol/probe leak identity evidence and inflate scores.
    hashes = {}
    for person in people:
        for path in person.rglob("*"):
            if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}: continue
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest in hashes: raise ValueError(f"Duplicate image: {path} equals {hashes[digest]}")
            hashes[digest] = path
    return enrolled, people, group_rows


def spoof_metrics(spoof: Path, genuine_paths: list[Path], engine, checker) -> list[dict]:
    def evaluate(paths: list[Path]) -> dict:
        passed, checked, unavailable = 0, 0, 0
        for path in paths:
            image, face, _, _ = one_face(path, engine)
            if face is None:
                unavailable += 1; continue
            result = checker.check(image, face)
            if result.reason == "liveness_not_checked": unavailable += 1; continue
            checked += 1; passed += int(result.passed)
        return {"total": len(paths), "checked": checked, "passed": passed, "unavailable": unavailable}
    genuine = evaluate(genuine_paths)
    rows = []
    for kind in ["print", "screen"]:
        attack = evaluate(require_images(spoof / kind))
        rows.append({"attack": kind, "APCER": safe_ratio(attack["passed"], attack["checked"]),
                     "BPCER": safe_ratio(genuine["checked"] - genuine["passed"], genuine["checked"]),
                     "attack_n": attack["total"], "attack_checked": attack["checked"],
                     "attack_nonresponse": attack["unavailable"], "bona_fide_n": genuine["total"],
                     "bona_fide_checked": genuine["checked"], "bona_fide_nonresponse": genuine["unavailable"],
                     "fail_closed_attack_acceptance": safe_ratio(attack["passed"], attack["total"]),
                     "fail_closed_bona_fide_rejection": safe_ratio(genuine["total"] - genuine["passed"], genuine["total"])})
    return rows


def box_recall(detected: list, truth: list) -> tuple[int, int]:
    if not detected: return 0, len(truth)
    a, b = np.asarray(detected), np.asarray(truth)
    low = np.maximum(a[:, None, :2], b[None, :, :2]); high = np.minimum(a[:, None, 2:], b[None, :, 2:])
    intersection = np.prod(np.maximum(0, high-low), axis=2)
    union = np.prod(a[:, 2:]-a[:, :2], axis=1)[:, None] + np.prod(b[:, 2:]-b[:, :2], axis=1)[None, :] - intersection
    iou = intersection / np.maximum(union, 1e-8)
    # Maximise the number of valid IoU >= .5 matches before their overlap quality.
    r, c = linear_sum_assignment(-((iou >= .5).astype(float) * 1000 + iou))
    return int(np.sum(iou[r, c] >= .5)), len(truth)


def group_metrics(folder: Path, labels: list[dict], gallery: dict, engine, checker, low: float, high: float, margin: float) -> tuple[list, list]:
    rows, student_counts = [], Counter()
    success, automatic = Counter(), Counter()
    for row in labels:
        frame = decode_image((folder / row["image"]).read_bytes()); faces = engine.detect(frame)
        checks = [checker.check(frame, f) for f in faces]
        # Recognition-only and complete passive-gated decisions are reported separately.
        recognition = match_faces([f.vector for f in faces], gallery, low, high, margin,
                                  quality=[not f.quality_reasons for f in faces])
        full = match_faces([f.vector for f in faces], gallery, low, high, margin,
                           live=[c.passed for c in checks], quality=[not f.quality_reasons for f in faces])
        predicted = {m.student_id for m in recognition if m.reason == "auto"}
        auto = {m.student_id for m in full if m.reason == "auto"}
        truth = set(row["ids"]); enrolled_truth = truth & set(gallery)
        for person in enrolled_truth:
            student_counts[person] += 1; success[person] += int(person in predicted); automatic[person] += int(person in auto)
        hits, total = box_recall([f.box for f in faces], row["boxes"]) if row["boxes"] is not None else (None, None)
        rows.append({"image": row["image"], "labelled_people": len(truth), "detected_faces": len(faces),
                     "count_coverage_proxy": min(len(faces), len(truth))/len(truth),
                     "matched_detections": hits, "annotated_faces": total,
                     "detection_recall_iou50": safe_ratio(hits, total) if total is not None else float("nan"),
                     "enrolled_present": len(enrolled_truth), "recognized_correct": len(predicted & enrolled_truth),
                     "recognition_recall": safe_ratio(len(predicted & enrolled_truth), len(enrolled_truth)),
                     "false_identity_accepts": len(predicted - truth),
                     "auto_present_correct": len(auto & enrolled_truth)})
    students = [{"person_id": p, "appearances": n, "recognized": success[p],
                 "recognition_recall": success[p]/n, "auto_present_recall": automatic[p]/n} for p, n in student_counts.items()]
    return rows, students


def pct(value: float) -> str:
    return f"{value * 100:.2f}%" if np.isfinite(value) else "not estimable (zero denominator)"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=Path("dataset"))
    parser.add_argument("--enrolled", type=Path, default=Path("enrolled.txt"))
    parser.add_argument("--spoof", type=Path, default=Path("spoof"))
    parser.add_argument("--group", type=Path, default=Path("group"))
    parser.add_argument("--group-labels", type=Path, default=Path("group_labels.csv"))
    parser.add_argument("--out", type=Path, default=Path("results"))
    parser.add_argument("--low", type=float, default=.35)
    parser.add_argument("--high", type=float, default=.50)
    parser.add_argument("--margin", type=float, default=.05)
    parser.add_argument("--target-far", type=float, default=.01)
    parser.add_argument("--split-name", default="validation", choices=["validation", "test"])
    parser.add_argument("--spoof-only", action="store_true")
    args = parser.parse_args()
    if not 0 <= args.low < args.high <= 1 or not 0 <= args.target_far <= 1 or not 0 <= args.margin <= 1:
        raise ValueError("Invalid thresholds, margin or FAR target")
    if args.spoof_only:
        paths = sorted(args.dataset.glob("*/probe/*/*.jpg"))
        if not paths: raise ValueError("Spoof evaluation needs bona-fide dataset/*/probe/*/*.jpg images for BPCER")
        for kind in ("print", "screen"): require_images(args.spoof / kind)
        rows = spoof_metrics(args.spoof, paths, get_face_engine(), get_liveness_checker())
        print(pd.DataFrame(rows).to_string(index=False)); return
    enrolled, people, group_labels = validate_layout(args.dataset, args.enrolled, args.spoof, args.group, args.group_labels)
    args.out.mkdir(parents=True, exist_ok=True)
    engine, checker = get_face_engine(), get_liveness_checker()
    gallery, timings, failures, probes, comparisons = {}, [], [], [], []
    for person in enrolled:
        vectors = []
        for path in images(args.dataset / person / "enrol"):
            _, face, reason, elapsed = one_face(path, engine); timings.append(elapsed)
            if face is None or reason: raise ValueError(f"Invalid enrolment sample {path}: {reason}. Replace before evaluation.")
            vectors.append(face.vector)
        gallery[person] = vectors
    bona_fide = []
    for person in people:
        conditions = CONDITIONS + (["mask"] if (person / "probe" / "mask").is_dir() else [])
        for condition in conditions:
            for path in require_images(person / "probe" / condition):
                bona_fide.append(path)
                image, face, reason, elapsed = one_face(path, engine); timings.append(elapsed)
                entry = {"person_id": person.name, "condition": condition, "known": person.name in gallery,
                         "detected": face is not None, "quality_ok": False, "live": False,
                         "best_id": None, "score": -1., "margin": 0., "reason": reason}
                if face is not None:
                    check = checker.check(image, face)
                    entry.update(quality_ok=not reason, live=check.passed, liveness_reason=check.reason)
                    matrix, ids = score_matrix([face.vector], gallery); row = matrix[0]; order = np.argsort(-row)
                    entry.update(best_id=ids[order[0]], score=float(row[order[0]]), margin=float(row[order[0]]-row[order[1]]))
                    for j, candidate in enumerate(ids):
                        comparisons.append({"condition": condition, "genuine": candidate == person.name,
                                            "score": float(row[j]), "known_probe": person.name in gallery})
                if reason: failures.append({"person_id": person.name, "condition": condition, "file": path.name, "reason": reason})
                probes.append(entry)
    comparisons = pd.DataFrame(comparisons)
    if comparisons.empty or not comparisons.genuine.any(): raise ValueError("No genuine scores: inspect detections and dataset")
    thresholds = np.round(np.arange(.20, .801, .01), 2)
    genuine = comparisons.loc[comparisons.genuine, "score"].to_numpy()
    impostor = comparisons.loc[~comparisons.genuine, "score"].to_numpy()
    overall = [rates(genuine, impostor, t) for t in thresholds]
    per_condition = []
    for condition, part in comparisons.groupby("condition"):
        g = part.loc[part.genuine, "score"].to_numpy(); im = part.loc[~part.genuine, "score"].to_numpy()
        per_condition.extend({"condition": condition, **rates(g, im, t)} for t in thresholds)
    pd.DataFrame(overall).to_csv(args.out / "metrics.csv", index=False)
    pd.DataFrame(per_condition).to_csv(args.out / "per_condition.csv", index=False)
    # No per-person vectors or comparison scores are written to disk.
    pd.DataFrame(failures, columns=["person_id", "condition", "file", "reason"]).to_csv(args.out / "failures.csv", index=False)
    error_rate, error_threshold = eer(genuine, impostor)
    chosen = recommend(overall, args.target_far)
    curve_thresholds = np.r_[-1.000001, np.unique(np.r_[genuine, impostor]), 1.000001]
    curve = [rates(genuine, impostor, t) for t in curve_thresholds]
    far = np.array([r["FAR"] for r in curve]); frr = np.array([r["FRR"] for r in curve])
    plt.figure(figsize=(7, 5)); plt.plot(far, 1-frr, color="#166534"); plt.plot([0, 1], [0, 1], "--", color="gray")
    plt.xlabel("False acceptance rate"); plt.ylabel("True acceptance rate"); plt.title("Recognition ROC (detected probes)"); plt.grid(alpha=.2); plt.tight_layout(); plt.savefig(args.out / "roc.png", dpi=170); plt.close()
    plt.figure(figsize=(7, 5)); plt.plot(norm.ppf(np.clip(far, 1e-5, 1-1e-5)), norm.ppf(np.clip(frr, 1e-5, 1-1e-5)))
    ticks = np.array([.001, .01, .05, .1, .2, .5, .8, .95, .99])
    plt.xticks(norm.ppf(ticks), [f"{100*t:g}" for t in ticks]); plt.yticks(norm.ppf(ticks), [f"{100*t:g}" for t in ticks])
    plt.xlabel("False acceptance rate (%)"); plt.ylabel("False rejection rate (%)"); plt.title("DET (normal-deviate axes)"); plt.grid(alpha=.2); plt.tight_layout(); plt.savefig(args.out / "det.png", dpi=170); plt.close()
    plt.figure(figsize=(7, 5)); plt.hist(genuine, bins=35, alpha=.6, label="Genuine", density=True); plt.hist(impostor, bins=35, alpha=.6, label="Impostor", density=True); plt.legend(); plt.xlabel("Cosine similarity"); plt.ylabel("Density"); plt.tight_layout(); plt.savefig(args.out / "score_distribution.png", dpi=170); plt.close()
    analyses = []
    for mode in ["recognition_only", "full_passive_pipeline"]:
        auto = [p for p in probes if p["detected"] and p["score"] >= args.high and p["margin"] >= args.margin and
                (mode == "recognition_only" or (p["quality_ok"] and p["live"]))]
        wrong = [p for p in auto if p["best_id"] != p["person_id"]]
        unknown = [p for p in probes if not p["known"]]
        unknown_auto = sum(not p["known"] for p in auto)
        analyses.append({"mode": mode, "probes": len(probes), "auto_accepted_fraction": len(auto)/len(probes),
                         "review_fraction": 1-len(auto)/len(probes), "wrong_auto_fraction_all_probes": len(wrong)/len(probes),
                         "wrong_auto_fraction_accepted": safe_ratio(len(wrong), len(auto)),
                         "unknown_probes": len(unknown), "unknown_rejection_rate": 1-safe_ratio(unknown_auto, len(unknown)),
                         "below_low_fraction": sum(p["score"] < args.low for p in probes)/len(probes),
                         "known_correct_auto_recall": safe_ratio(sum(p["known"] and p["best_id"] == p["person_id"] for p in auto), sum(p["known"] for p in probes))})
    pd.DataFrame(analyses).to_csv(args.out / "two_threshold.csv", index=False)
    spoof_rows = spoof_metrics(args.spoof, bona_fide, engine, checker)
    pd.DataFrame(spoof_rows).to_csv(args.out / "spoof_metrics.csv", index=False)
    groups, group_students = group_metrics(args.group, group_labels, gallery, engine, checker, args.low, args.high, args.margin)
    pd.DataFrame(groups).to_csv(args.out / "group_metrics.csv", index=False)
    pd.DataFrame(group_students).to_csv(args.out / "group_per_student.csv", index=False)
    metadata = {"split": args.split_name, "thresholds": {"low": args.low, "high": args.high, "margin": args.margin},
                "platform": platform.platform(), "python": platform.python_version(), "processor": platform.processor(),
                "passive_backend": type(checker).__name__, "enrolled_people": len(enrolled),
                "mean_image_seconds": float(np.mean(timings)), "p95_image_seconds": float(np.percentile(timings, 95))}
    (args.out / "run.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    text = ["# PUB AttendEye evaluation", "", f"Split: {args.split_name}. These results were computed from local volunteer data.",
            f"Gallery: {len(enrolled)} people. Probes: {len(probes)}. Genuine comparisons: {len(genuine)}; impostor comparisons: {len(impostor)}.",
            "", "## Recognition", f"Interpolated empirical EER: {pct(error_rate)} at threshold {error_threshold:.4f}.",
            "Scores use maximum cosine similarity over each student's samples. ROC/FAR/FRR are comparison-level metrics conditional on exactly one detected face; quality failures remain in the score distribution. Missing detections are not silently turned into fake cosine scores.",
            f"No-single-face failures: {sum(not p['detected'] for p in probes)}. Detected but quality-rejected probes: {sum(p['detected'] and not p['quality_ok'] for p in probes)}.",
            "Precision and F1 depend on the genuine/impostor balance in this test, not classroom prevalence.", "", "## Threshold recommendation"]
    if chosen:
        upper = wilson_upper(chosen["FP"], chosen["impostor_n"])
        text += [f"Lowest tested threshold meeting empirical FAR <= {pct(args.target_far)}: T_high={chosen['threshold']:.2f}.",
                 f"At this threshold FAR={pct(chosen['FAR'])}, FRR={pct(chosen['FRR'])}; false accepts={chosen['FP']}/{chosen['impostor_n']}.",
                 f"Approximate 95% Wilson upper FAR bound: {pct(upper)}. Pairwise scores are correlated, so this interval is descriptive, not a population guarantee.",
                 "This minimizes the tested threshold subject to the observed FAR target. Freeze the choice on validation data and evaluate once on a separate test split. No automatic settings change was made."]
    else:
        text += [f"No threshold in 0.20..0.80 meets empirical FAR <= {pct(args.target_far)}. No recommendation can be made from this sweep."]
    if args.split_name == "test": text += ["This is a test run: any threshold recommendation above is exploratory only. Do not tune on the final test set."]
    text += ["", "## Open set and two thresholds", f"Chosen settings: T_low={args.low:.2f}, T_high={args.high:.2f}, margin={args.margin:.2f}."]
    for row in analyses:
        text += [f"{row['mode']}: auto accepted {pct(row['auto_accepted_fraction'])}; review {pct(row['review_fraction'])}; wrongly auto accepted / all probes {pct(row['wrong_auto_fraction_all_probes'])}; wrongly auto accepted / accepted {pct(row['wrong_auto_fraction_accepted'])}; unknown rejection {pct(row['unknown_rejection_rate'])}; known correct auto recall {pct(row['known_correct_auto_recall'])}."]
    text += ["Below T_low means unknown review, not automatic rejection from the queue. Unknown rejection here means no automatic identity acceptance; quality/liveness failures also contribute. Active challenge and live voting are not evaluated by a still-photo dataset.", "", "## Spoof evaluation", f"Passive backend: {type(checker).__name__}."]
    for row in spoof_rows:
        text += [f"{row['attack']}: APCER={pct(row['APCER'])}; BPCER={pct(row['BPCER'])}; attacks checked={row['attack_checked']}/{row['attack_n']}; attack nonresponses={row['attack_nonresponse']}; bona-fide nonresponses={row['bona_fide_nonresponse']}."]
    text += ["APCER is attacks accepted / attacks checked. BPCER is bona-fide rejected / bona-fide checked. Nonresponses are reported separately; fail-closed end-to-end rates are in spoof_metrics.csv. BPCER uses the same bona-fide set for both attack types. Baseline results measure the conservative fallback policy, not MiniFASNet quality.", "", "## Group photographs"]
    annotated = [r for r in groups if r["annotated_faces"] is not None]
    if annotated:
        text += [f"Detection recall at IoU >= 0.5 on annotated groups: {pct(safe_ratio(sum(r['matched_detections'] for r in annotated), sum(r['annotated_faces'] for r in annotated)))}."]
    if len(annotated) != len(groups):
        text += ["Some group labels contain only identities. Exact detection recall is NOT identifiable without ground-truth boxes. count_coverage_proxy is an optimistic count proxy, not detection recall; false detections can inflate it. Add boxes_json to obtain IoU-based recall."]
    text += [f"Recognition recall over enrolled person appearances: {pct(safe_ratio(sum(r['recognized_correct'] for r in groups), sum(r['enrolled_present'] for r in groups)))}. Per-person rates are in group_per_student.csv.",
             "", "## CPU timing", f"Measured mean detection/embedding time per image: {metadata['mean_image_seconds']:.4f} s; p95: {metadata['p95_image_seconds']:.4f} s. Model construction excluded. This is not a full API latency benchmark.",
             f"Platform: {metadata['platform']}; processor: {metadata['processor'] or 'not reported by OS'}.",
             "", "## Interpretation", "Small, convenience-sampled datasets cannot establish campus-wide accuracy, demographic fairness or resistance to unseen attacks. Report per-condition metrics and failures, keep identities separate from published results, and avoid using this prototype for punitive attendance decisions."]
    (args.out / "summary.md").write_text("\n\n".join(text) + "\n", encoding="utf-8")
    print(f"Evaluation complete: {args.out / 'summary.md'}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, FileNotFoundError, OSError) as exc:
        raise SystemExit(f"Evaluation failed: {exc}") from exc

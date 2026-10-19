"""Pure matching functions shared by API, evaluation and synthetic tests."""
from dataclasses import dataclass
from collections import defaultdict
import numpy as np
from scipy.optimize import linear_sum_assignment


def normalize(vector: np.ndarray) -> np.ndarray:
    value = np.asarray(vector, dtype=np.float32)
    norm = np.linalg.norm(value)
    if norm < 1e-8 or not np.isfinite(value).all():
        raise ValueError("Invalid embedding")
    return value / norm


def score_matrix(faces: list[np.ndarray], gallery: dict[int | str, list[np.ndarray]]) -> tuple[np.ndarray, list]:
    ids = list(gallery)
    if not faces or not ids:
        return np.zeros((len(faces), len(ids)), dtype=np.float32), ids
    probes = np.stack([normalize(v) for v in faces])
    matrix = np.column_stack([np.max(probes @ np.stack([normalize(v) for v in gallery[k]]).T, axis=1)
                              for k in ids])
    return np.clip(matrix, -1, 1), ids


def decision(score: float, margin: float, low: float = .35, high: float = .50,
             min_margin: float = .05, live: bool = True, quality: bool = True) -> str:
    if not quality:
        return "quality_fail"
    if not live:
        return "liveness_fail"
    if score < low:
        return "unknown"
    if score >= high and margin >= min_margin:
        return "auto"
    return "ambiguous"


@dataclass
class Match:
    face_index: int
    student_id: int | str | None
    score: float
    margin: float
    reason: str
    candidates: list[dict]


def match_faces(faces: list[np.ndarray], gallery: dict, low: float = .35,
                high: float = .50, min_margin: float = .05,
                live: list[bool] | None = None, quality: list[bool] | None = None) -> list[Match]:
    matrix, ids = score_matrix(faces, gallery)
    live = live if live is not None else [True] * len(faces)
    quality = quality if quality is not None else [True] * len(faces)
    if not ids:
        return [Match(i, None, -1., 0., "unknown", []) for i in range(len(faces))]
    # Dummy columns permit unmatched faces. Low-quality/spoof faces cannot consume a student.
    eligible = np.asarray(live) & np.asarray(quality)
    benefits = matrix.astype(float) - low
    benefits[~eligible, :] = -10
    augmented = np.column_stack([benefits, np.zeros((len(faces), len(faces)))])
    rows, cols = linear_sum_assignment(-augmented)
    assigned = dict(zip(rows.tolist(), cols.tolist()))
    results = []
    for i, row in enumerate(matrix):
        order = np.argsort(-row)
        candidates = [{"student_id": ids[j], "score": float(row[j])} for j in order[:3]]
        column = assigned[i]
        real = column < len(ids)
        chosen = column if real else int(order[0])
        score = float(row[chosen])
        others = np.delete(row, chosen)
        margin = score - float(others.max()) if len(others) else 2.
        reason = decision(score, margin, low, high, min_margin, live[i], quality[i])
        if reason == "auto" and not real:
            reason = "assignment_conflict"
        results.append(Match(i, ids[chosen] if real else None, score, margin, reason, candidates))
    return results


def fuse_frames(frames: list[list[Match]], votes_required: int = 2) -> dict:
    """At most one vote per identity per frame; only fully eligible auto decisions count."""
    votes = defaultdict(list)
    for matches in frames:
        best = {}
        for match in matches:
            if match.reason == "auto" and match.student_id is not None:
                best[match.student_id] = max(best.get(match.student_id, -1), match.score)
        for student_id, score in best.items():
            votes[student_id].append(score)
    return {key: {"votes": len(scores), "confidence": float(np.mean(scores))}
            for key, scores in votes.items() if len(scores) >= votes_required}

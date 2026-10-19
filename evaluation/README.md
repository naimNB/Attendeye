# PUB AttendEye evaluation

This evaluator uses `backend/app/services/face_engine.py`, `matching.py`, and `liveness.py`. It never downloads a substitute recognizer. Results are created only when you run it with real, consenting volunteer data. No dataset or measured results are bundled.

## Collect separate development and test sets

Recruit adult volunteers without pressure. Offer manual attendance and the right to withdraw. Obtain the separate evaluation consent in `consent_form.md` before saving any photographs. Use random person IDs, not student numbers or names. Keep the name-to-ID map and signed consent forms separately on an access-controlled encrypted drive.

The application never saves raw enrolment images. **This offline evaluation dataset intentionally contains raw photographs**, so it requires separate consent, storage protection and a deletion date. Do not put it in Git, the submission archive, public cloud buckets, slides, or screenshots. Stop data collection if someone has not consented. Include only consenting people in the background of group photographs.

For each enrolled volunteer collect 5–10 enrolment photographs: front, slight left, slight right, slight up, slight down, with optional repeats. Collect probes during a separate capture session. Never reuse an enrolment photograph as a probe. Exact duplicate files are rejected by the evaluator; manually inspect near duplicates too. Use additional volunteers only as open-set probes and omit their IDs from `enrolled.txt`.

Use validation data to choose thresholds. Freeze thresholds and record the model manifest, then run on an untouched test set. Split by collection session and, where feasible, use a separate cohort for final validation of generalization. Do not repeatedly tune on the final test set. Report volunteer and image counts and the collection protocol, not only percentages.

## Layout

Paths below are relative to `evaluation/`:

```text
dataset/
  p001/
    enrol/                       5–10 unique images
    probe/
      bright/
      dim/
      backlit/
      angle30/
      angle45/
      far/
      glasses/
      mask/                      optional
  p002/                          another enrolled volunteer
    enrol/
    probe/                       same required condition folders
  u001/                          consenting unknown volunteer
    probe/                       same required condition folders; no enrol folder required
spoof/
  print/                         camera photos of consented printed portraits
  screen/                        camera photos of consented portraits on a screen
group/
  class01.jpg
group_labels.csv
enrolled.txt
```

Include all seven required condition folders for every person, with at least one photo each; multiple independent captures are better. At least two enrolled identities and one unknown identity are required. `enrolled.txt` contains one enrolled directory name per line. IDs absent from this file are never added to the gallery, even if they have an enrol folder.

`group_labels.csv` uses semicolon-delimited identity lists inside a normal CSV field:

```csv
image,person_ids
class01.jpg,p001;p002;u001
```

Identity labels alone cannot establish which detections are real faces. For **actual detection recall**, add `boxes_json` containing one `[x1,y1,x2,y2]` ground-truth box per identity, in the same order, in EXIF-corrected image coordinates. This is a JSON array inside a CSV-quoted field, for example:

```csv
image,person_ids,boxes_json
class01.jpg,p001;p002,"[[100,80,180,180],[240,90,320,190]]"
```

The coordinates above illustrate the file format only; annotate your own photos. With boxes, detection recall uses one-to-one IoU >= 0.5 matching. Without boxes, detection recall is left blank and only `count_coverage_proxy` is reported. The proxy can be inflated by false detections and must not be presented as detection recall. Recognition recall uses correctly recognized enrolled identities / enrolled identities present, with Hungarian assignment.

## Run later

Activate the backend virtual environment and complete model setup first. From `attendeye/backend`, run:

```bash
cd ../evaluation
python evaluate.py --dataset dataset --enrolled enrolled.txt --low 0.35 --high 0.50 --target-far 0.01 --split-name validation
```

The face engine uses environment settings. To use the same backend `.env` from this directory, either export its variables into your shell or run the evaluator from `backend/` using explicit paths:

```bash
python ../evaluation/evaluate.py --dataset ../evaluation/dataset --enrolled ../evaluation/enrolled.txt --spoof ../evaluation/spoof --group ../evaluation/group --group-labels ../evaluation/group_labels.csv --out ../evaluation/results
```

Run a separate final test using another dataset folder and `--split-name test`, supplying the thresholds already chosen on validation. Test-run recommendations are labelled exploratory; they must not drive retuning.

Spoof-only mode:

```bash
python ../evaluation/evaluate.py --dataset ../evaluation/dataset --spoof ../evaluation/spoof --spoof-only
```

This mode also requires bona-fide probe JPGs. **BPCER cannot be computed from spoof images alone.** The complete evaluator supports JPEG, PNG and WEBP; the convenient spoof-only probe glob expects `.jpg` files.

CPU benchmark (uses a real local photograph):

```bash
python ../evaluation/benchmark.py ../evaluation/group/class01.jpg --runs 5 --out ../evaluation/results/benchmark.json
```

Benchmark includes detection, alignment and embeddings after a warm-up; it excludes initial model loading, liveness, database writes and HTTP latency. API capture responses separately return full processing `elapsed_ms`. Record CPU model, RAM, resolution, face count and tiling settings alongside timings.

## Outputs and definitions

| File | Meaning |
|---|---|
| `results/metrics.csv` | Thresholds 0.20 through 0.80 inclusive, FAR, FRR, precision, recall, F1, counts |
| `results/per_condition.csv` | Same sweep separately for each condition |
| `results/roc.png` | Empirical recognition ROC using full score range and endpoints |
| `results/det.png` | DET with normal-deviate axes |
| `results/score_distribution.png` | Genuine/impostor score distributions |
| `results/two_threshold.csv` | Recognition-only and full passive-gated acceptance, review and unknown rejection |
| `results/spoof_metrics.csv` | Per-attack APCER, common bona-fide BPCER, nonresponse and fail-closed rates |
| `results/group_metrics.csv` | Group detection/recognition counts and recalls |
| `results/group_per_student.csv` | Per-person group recognition and passive-gated recall |
| `results/failures.csv` | Failed face counts and quality gates; pseudonymous, still restricted |
| `results/run.json` | Environment and run configuration |
| `results/summary.md` | Plain-English report derived from measured data |

A genuine comparison is a detected probe scored against its own identity's enrolment set. An impostor comparison is against another enrolled identity, including open-set probes. Each identity score is the **maximum** sample cosine score, matching the app. These comparison-level FAR/FRR values are not the same as session-level mistaken attendance rates. Repeated comparisons from one person are correlated. Precision depends on the test pair balance.

Detection failures are counted separately and are included as non-auto decisions in operational analysis; they are not assigned fabricated cosine scores. Quality failures remain visible in the conditional recognition score distribution and are excluded by the full pipeline. A person below T_low remains in unknown review; every non-auto result goes to review. The recommendation selects the lowest **tested** threshold meeting the empirical FAR target, reports denominators and a descriptive Wilson bound, and makes no population guarantee. EER is interpolated where empirical FAR and FRR cross over all score cut-points, not just the 0.20–0.80 grid.

APCER and BPCER exclude unavailable checks and report nonresponses separately. The fail-closed rates include nonresponses. Both attack types share the same bona-fide denominator; BPCER is not an attack-specific statistic. The still-image dataset cannot validate active challenge freshness or multi-frame voting. Collect separately consented ordered bursts for future active-liveness testing.

Aggregate results are not proof of fairness. Compare conditions and, only with appropriate voluntary data and sufficient counts, relevant subgroups. Never infer sensitive demographics from faces. Publish aggregate findings with uncertainty, not volunteer identifiers.

# PUB AttendEye — project report

**Track:** B4 · **Scope:** ten-day university hackathon · **Deployment:** one CPU-only Windows/Linux laptop, localhost · **Team:** 3–4 members

## 1. Problem and objective

Manual attendance consumes class time and can produce transcription errors. A classroom image is difficult evidence: faces can be small, blurred, occluded, poorly lit or visually similar. A system that marks every detected face as a student would turn uncertainty into incorrect attendance records.

PUB AttendEye demonstrates a consent-based assistant for teachers. It identifies likely enrolled students, flags uncertain observations, and lets an authorised teacher review decisions with an audit trail. The project does not claim production-grade identity verification or replace a manual attendance option.

## 2. Scope and users

Students explicitly consent, enrol five to ten samples covering guided poses, inspect their own attendance and delete their biometric data. Teachers manage sessions within time windows, capture images or frame bursts, resolve reviews, correct records with reasons, close sessions and export reports. Administrators maintain users, academic rosters, teacher assignments and recognition settings. Optional QR sessions require a current signed classroom token and a live face check linked to the signed-in student.

The implementation uses Python/FastAPI, SQLAlchemy 2, Pydantic v2, SQLite, PyJWT, direct bcrypt, Fernet, InsightFace with CPU ONNX Runtime, OpenCV, NumPy, SciPy, pandas, ReportLab and pytest. The JavaScript UI uses React/Vite, Tailwind, React Router, Axios and Recharts. Small supporting packages handle multipart forms, EXIF decoding, environment files and QR rendering. SQLite can be replaced through DATABASE_URL and a PostgreSQL driver, while schema migration and distributed deployment remain future work.

## 3. Architecture

The browser acquires camera frames with getUserMedia, sends bounded image requests and displays decisions. FastAPI guards role and section access before data processing. Synchronous vision endpoints run in FastAPI's worker threadpool, leaving the event loop available; the browser shows capture counts and processing state. A small processing semaphore bounds concurrent inference requests, and a model lock avoids unsafe concurrent detector calls.

The database stores academic records and encrypted vectors. Temporary thumbnails live in a private encrypted directory behind a guarded endpoint. A cleanup task removes expired/resolved thumbnails and runs again at startup. The evaluator imports the same face engine and matcher to avoid a different measurement pipeline. See `DIAGRAMS.md` for architecture, pipeline, ER and review diagrams.

## 4. Pipeline, step by step

1. **Authorisation and timing.** Validate the JWT, current role, assigned section and open session time window. Teacher captures require an affirmation that everyone pictured consents. Live requests carry a one-time challenge token.
2. **Input validation.** Limit request/image bytes and decoded pixels. Accept JPEG/PNG/WEBP only after actual decoding. Correct EXIF orientation and convert RGB to BGR. App raw inputs remain in RAM.
3. **Detection.** InsightFace detects faces. Large images additionally use overlapping tiles. When small faces appear, optional two-times tile upscaling gives the detector a better opportunity to find them. NMS removes overlapping duplicate detections. Upscaling does not reconstruct lost identity information.
4. **Quality.** Check native-image face dimensions, Laplacian variance for blur, mean intensity for darkness and estimated pose. Failed attendance observations go to review with a reason; enrolment failures are rejected for recapture.
5. **Alignment and embedding.** InsightFace aligns faces from landmarks and produces 512-dimensional embeddings. Convert to float32 and L2-normalise. Enrolment encrypts vectors with Fernet before storage. No API returns them.
6. **Passive liveness.** A pluggable `LivenessChecker.check(image, face)` uses one exported MiniFASNetV2 ONNX model when available. Its expanded BGR crop and input scale follow the selected model contract. If unavailable, log and use a texture/moire baseline. The default baseline never auto-accepts. Crops below the configured passive minimum are `liveness_not_checked` and go to review.
7. **Gallery selection.** Restrict the gallery to students enrolled in the session's section with active consent and complete five-pose enrolment. Decrypt vectors only for in-memory matching.
8. **Identity scoring.** Compare each normalised face vector with every stored sample. An identity's score is its maximum sample cosine. Build a faces × identities matrix. Add dummy unmatched choices and apply Hungarian assignment so an identity cannot be assigned to two detected faces in one image. Ineligible observations cannot consume a valid identity assignment.
9. **Threshold and margin.** A score at least T_high and a lead of at least the margin over every other identity is eligible for automatic presence. Scores between T_low and T_high or with a small margin require review. Scores below T_low become unknown review. Any failed quality or liveness check blocks automatic presence. Scores are similarities, not probabilities.
10. **Live challenge and voting.** The server randomly selects blink or a head-turn direction and issues a signed, user/session-bound token with a 15-second deadline. An ordered burst validates eye-aspect-ratio or yaw transitions with identity consistency. Duplicate byte-identical frames are rejected. At least two eligible agreeing frame decisions are required. Tracking is conservative; incomplete or inconsistent tracks go to review.
11. **Human review.** Store a small encrypted thumbnail temporarily plus up to three candidate identities. An assigned teacher confirms a candidate, selects another roster member or rejects the observation. Confirmations and later corrections require reasons and append audit entries. Resolved thumbnails are removed.
12. **Close and recalculate.** Closing a session adds absent records only for roster members without a record. Attendance equals present records / closed sessions of that section. Before any session closes, the percentage is unavailable. Recalculate alerts after closure and correction. Repeated automatic recognition never overwrites a manual correction.

## 5. Optional QR + face check-in

Every 30 seconds the teacher UI refreshes a signed QR token bound to a session and time window. The student scans or enters it, obtains a separate active challenge and submits an eight-frame burst. The server validates both token purposes and bindings, current QR window, enrolled identity, passive liveness, active motion and matching votes. It then atomically stores a unique student/session redemption and attendance record. Used challenges cannot be reused even after inference failure. Students cannot check in as another matched identity. QR-required sessions do not allow ordinary review/correction to create an unverified present record.

A QR code can be relayed. A webcam request can be forged by a modified client. The prototype has no hardware camera attestation and does not prove physical classroom location.

## 6. Privacy and security

Consent is explicit, versioned and timestamped. Biometric withdrawal deletes embeddings and revokes consent; it also conservatively clears temporary crops/candidate lists because uncertain identity suggestions cannot locate every image of a particular person. Attendance history remains. The separate evaluation dataset requires additional permission because it contains raw images.

Fernet keys and JWT secrets are generated locally and excluded from Git. Passwords use bcrypt. Role/section guards protect sensitive routes. CORS uses explicit origins, login attempts are rate-limited, uploads are bounded, and CSV output neutralises spreadsheet formulas. Thumbnails are encrypted and never public static assets. Logs avoid biometric content. The audit API is read-only, although a database administrator can still alter its underlying storage. See `PRIVACY.md` and `SECURITY_AUDIT.md` for precise retention and threat-model boundaries.

## 7. Evaluation method

Use consenting enrolled and unknown volunteers; separate enrolment and probe sessions, validation and final testing. Required conditions are bright, dim, backlit, 30° angle, 45° angle, far and glasses; mask is optional. Compute genuine and impostor maximum-over-sample cosine scores. Sweep 0.20–0.80 by 0.01; report FAR, FRR, precision, recall and F1, plus empirical interpolated EER, ROC and DET. Recommend the lowest tested threshold satisfying the configured empirical FAR target on validation only.

Report unknown rejection, auto/review coverage and wrong automatic accepts under the selected low/high thresholds. Give both recognition-only and quality/passive-gated operational metrics. Count detector failures separately; never fabricate scores for undetected faces. Measure print/screen APCER and bona-fide BPCER with nonresponses disclosed. For group photographs, use labelled identities for recognition recall; true detection recall additionally requires bounding-box annotation and one-to-one IoU matching. A count proxy cannot replace that metric.

Measure CPU detection/embedding time after warm-up and full API processing latency separately. Record hardware, resolution, model/configuration and face count. Confidence intervals from correlated pairwise scores are only descriptive; obtain larger independent samples before general claims.

## 8. Results — insert your actual measurements

No evaluation or benchmark was executed when this project was generated. Replace this section only after running the evaluator. Copy numbers and denominators from your own `evaluation/results/summary.md` and CSV files. Do not copy upstream model marketing numbers.

| Item | Your measured result |
|---|---|
| Enrolled / unknown volunteers; enrolment / probe counts | **[INSERT REAL COUNTS]** |
| Validation and test capture-session split | **[INSERT REAL SPLIT]** |
| Selected T_low / T_high / margin and FAR target | **[INSERT REAL SETTINGS AND JUSTIFICATION]** |
| FAR / FRR / F1 at selected T_high, with denominators | **[INSERT REAL METRICS]** |
| EER and threshold | **[INSERT REAL EER]** |
| Per-condition findings and detection/quality failures | **[INSERT REAL FINDINGS]** |
| Unknown rejection | **[INSERT REAL RATE AND DENOMINATOR]** |
| Auto accepted / review / wrong auto accepted | **[INSERT REAL RATES AND DENOMINATORS]** |
| Print APCER / screen APCER / BPCER / nonresponses | **[INSERT REAL SPOOF RESULTS AND BACKEND NAME]** |
| Group detection recall at IoU 0.5 | **[INSERT REAL BOX-ANNOTATED RESULT OR SAY NOT MEASURED]** |
| Group per-student recognition recall | **[INSERT REAL RESULTS]** |
| CPU mean and p95 seconds/image; hardware/configuration | **[INSERT REAL TIMING]** |

DEMO attendance sessions exist only to populate charts. They are not experimental evidence and must never appear in the recognition results table.

## 9. Limitations

- Distant, occluded or poorly lit faces may not produce useful embeddings. Tiling costs CPU time; interpolation cannot recover missing detail.
- Texture heuristics are weak. MiniFASNet can shift across cameras, media and lighting; this uses one model rather than the upstream ensemble.
- Sparse blink sampling and estimated 3D landmarks can miss real blinks. Pose sign/calibration must be checked on the target camera. Active challenges are not proof against responsive replay or synthetic video.
- A small volunteer dataset does not establish fairness, accuracy on the student population, or a stable 1% FAR guarantee.
- SQLite and process-local locks/rate limits are suitable for the specified single-worker localhost prototype, not a distributed deployment.
- Changing models requires re-enrolment and retuning; old embeddings must not be mixed across models.
- Physical thumbnail deletion pauses while the computer/server is off unless an OS job runs; expired files remain inaccessible through the API.
- The schema has no temporal enrolment history, so rosters freeze after the first session. New rosters need new sections.
- Phone camera access needs a secure origin; ordinary LAN HTTP does not satisfy modern browser requirements.
- Dependencies/models are external downloads. Installation, inference and runtime tests must be performed on the actual target laptop before demonstration.

## 10. Future work

Add robust camera-tested anti-spoofing, higher-frequency active challenge capture, device attestation where feasible, temporal enrolment membership, schema migrations, distributed locking/rate limits, stronger audit integrity and key rotation tooling. Expand evaluation with independent capture sessions and uncertainty analysis, obtain institutional review, and retain a usable human alternative for every volunteer.

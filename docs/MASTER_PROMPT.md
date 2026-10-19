# Master Prompt — PUB AttendEye source of truth

The original project specification is reproduced below. The additional tasks after the master specification are cumulative. The final instruction is to create the full project without running it. The debugging template at the end is a reusable future instruction, not a current traceback.

## Master specification

ROLE
You are a senior full-stack and computer-vision engineer. Build a complete, runnable project called "PUB AttendEye", a computer-vision smart attendance system for a university hackathon (Track B4). This text is the project's source of truth; I will paste it into later chats.

CONSTRAINTS
- 10-day hackathon, team of 3-4, CPU-only laptops, runs on localhost, must work on Windows 10/11 and Linux.
- Only consenting volunteers' faces. Store face embeddings, never raw enrolment photos. Protect all biometric data.
- Pretrained models are allowed, but the whole pipeline must be simple enough to explain in a viva.

STACK (do not change without asking)
Backend: Python 3.10/3.11, FastAPI, SQLAlchemy 2, Pydantic v2, SQLite by default (DATABASE_URL env var so PostgreSQL works later), PyJWT, bcrypt (the bcrypt package directly, not passlib), cryptography (Fernet), insightface + onnxruntime (CPU), opencv-python-headless, numpy, scipy, pandas, reportlab, pytest.
Frontend: React + Vite (JavaScript), Tailwind CSS, React Router, Axios, Recharts. Webcam through getUserMedia.

ROLES AND FEATURES
Student: enrols face samples with explicit consent (checkbox saved with timestamp), 5-10 samples per student, guided poses (front, left, right, up, down); a sample is rejected if blurry, too dark, too small, or contains more than one face; sees own attendance % per course; gets an in-app alert when below the limit; can delete own biometric data.
Teacher: creates a class session (course, section, start/end time window); captures attendance from live webcam (several frames over ~3 s) or an uploaded classroom photo; reviews flagged faces; corrects any record with a mandatory reason; closes a session; exports reports.
Admin: manages users, courses, sections, enrolments, teacher assignments; sets the global attendance limit (default 75%) and the recognition thresholds.

RECOGNITION PIPELINE (services/face_engine.py and services/matching.py)
1. Decode image, fix EXIF orientation.
2. Detect all faces with InsightFace (model name from env, default buffalo_l; det_size configurable).
3. Quality gate per face: minimum face size, blur (Laplacian variance), pose. Failures go to review with a reason.
4. Align and embed (512-d, L2-normalised float32).
5. Liveness through a LivenessChecker interface (services/liveness.py). For now implement a simple passive baseline (texture and moire based heuristic) plus a blink-challenge endpoint using eye aspect ratio from landmarks. Keep it pluggable so a better model can replace it later.
6. Matching: gallery = only students enrolled in the session's course+section. Per-student score = max cosine similarity over their samples. Build a faces x students score matrix and use the Hungarian algorithm (scipy linear_sum_assignment) so one student cannot match two faces.
7. Decision with two thresholds from settings (defaults T_high=0.50, T_low=0.35; they will be tuned later from evaluation):
   - score >= T_high and margin to second-best >= 0.05 -> auto present
   - T_low <= score < T_high, or small margin -> review queue with the top-3 candidate students
   - score < T_low -> review as "unknown"
   - liveness fail -> review with reason "liveness_fail", never auto-present
8. Live capture: accept N frames (5-8) per request, process each, fuse per student (>= 2 agreeing frames above T_high), then decide.
9. Review items keep a small face-crop thumbnail only temporarily (auto-delete after 24 h or when resolved). Teacher actions: confirm candidate, choose another student, or reject.
10. On session close, enrolled students without a present record become absent.

DATABASE (SQLAlchemy models)
users(id, name, email, password_hash, role, student_code nullable, created_at)
courses(id, code, title); sections(id, course_id, name); teacher_assignments(teacher_id, section_id)
enrolments(student_id, section_id)
consents(id, student_id, text_version, granted_at, revoked_at)
face_embeddings(id, student_id, vector_encrypted BLOB, pose_label, created_at)
class_sessions(id, section_id, teacher_id, starts_at, ends_at, status[open/closed], closed_at)
attendance_records(id, session_id, student_id, status[present/absent], confidence, source[auto/manual], updated_at)
review_items(id, session_id, thumbnail_path, candidates_json, reason, status[pending/resolved], resolved_by, resolved_at)
audit_log(id, actor_id, record_id, old_status, new_status, reason, created_at)
settings(key, value); notifications(id, user_id, message, read, created_at)

API (REST, JWT, role-guarded)
auth: POST /auth/login, GET /auth/me
admin: CRUD /users, /courses, /sections, /enrolments, /teacher-assignments; GET/PUT /settings
enrolment: POST /enrol/consent, POST /enrol/sample (one image per call), GET /enrol/status, DELETE /enrol/me
sessions: POST /sessions, GET /sessions, POST /sessions/{id}/capture-photo, POST /sessions/{id}/capture-frames, POST /sessions/{id}/close
review: GET /sessions/{id}/review, POST /review/{item_id}/resolve
attendance: PUT /attendance/{record_id} (status + reason required), GET /attendance/me (per-course %), GET /sessions/{id}/records
reports: GET /reports/course/{section_id}?format=csv|pdf, GET /reports/date/{session_id}?format=csv|pdf
notifications: GET /notifications, POST /notifications/{id}/read
Attendance % = present / closed sessions of that section. Recalculate after session close and after every correction; create a notification when below the limit.

FRONTEND PAGES
Login. Student: enrolment wizard (consent, guided webcam capture, progress), my attendance (cards, %, alert banner). Teacher: sessions list, new session, capture page (webcam preview + photo upload, results with bounding boxes), review queue (thumbnail + top-3 candidate buttons), records with correction dialog, report downloads. Admin: users, courses/sections, enrolments, settings. Clean, responsive Tailwind design.

SECURITY AND PRIVACY
Embeddings encrypted with Fernet (key from .env, never committed); the API never returns embeddings; bcrypt password hashing; JWT expiry; role checks on every route; capture allowed only inside the session time window; consent required before any enrolment sample is stored; deleting biometric data removes all embeddings and marks consent revoked.

DELIVERABLES AND RULES
- Complete working files. No placeholders, no "...". Add type hints, error handling and logging.
- Include: README with Windows and Linux run steps, .env.example, requirements.txt, scripts/seed.py (1 admin, 2 teachers, 8 clearly fake demo students, 2 courses, sections, enrolments), and pytest tests for matching, thresholds and attendance % using synthetic embeddings.
- Layout: attendeye/backend/app/{main.py, config.py, database.py, models.py, schemas.py, security.py, deps.py, routers/, services/}, backend/tests/, frontend/src/{pages, components, api}, evaluation/ (empty for now).
- Output order: 1) file tree, 2) backend files, 3) frontend files, 4) README. If you hit the output limit, stop at a file boundary and I will say "continue". Print every file completely with its path as a heading.
- Never invent accuracy numbers anywhere.

## Additional task — evaluation

(Paste the Master Prompt first.)
TASK: Build evaluation/ for PUB AttendEye.
Dataset layout: dataset/<person_id>/enrol/*.jpg, dataset/<person_id>/probe/<condition>/*.jpg with conditions bright, dim, backlit, angle30, angle45, far, glasses (mask optional); spoof/<print|screen>/*.jpg; group/*.jpg with group_labels.csv (image, person_ids present).
evaluate.py must:
- Compute embeddings with the same face_engine used by the app.
- Compute genuine and impostor cosine scores, overall and per condition.
- For thresholds 0.20..0.80 step 0.01 report FAR, FRR, precision, recall, F1; compute EER; plot ROC and DET (PNG, matplotlib).
- Open-set test: probes of people NOT enrolled, to measure unknown-rejection.
- Two-threshold analysis for chosen (T_low, T_high): % auto-accepted, % sent to review, % wrongly auto-accepted.
- Recommend T_high as the lowest threshold with FAR <= 1% (configurable) and write the justification.
- Spoof evaluation: APCER and BPCER for print and screen attacks.
- Group photo test: detection recall and per-student recognition recall from group_labels.csv.
- Outputs: results/metrics.csv, results/per_condition.csv, results/*.png, results/summary.md in plain English for the report.
- Never fabricate numbers; fail clearly if dataset folders are missing.
Also write: a README on how to collect the dataset, an English consent form template for volunteers, and a data-collection checklist (people, lighting, angles, distances, spoof shots).

## Additional task — liveness

(Paste the Master Prompt first.)
TASK: Upgrade services/liveness.py without changing the LivenessChecker interface.
1. Add passive anti-spoofing with a pretrained MiniFASNet (Silent-Face-Anti-Spoofing) ONNX model; add a download script and a config path; fall back to the baseline if the model is unavailable and log which one is active.
2. Active challenge for live webcam mode: random blink or head-turn prompt shown in the UI, validated server-side from a short frame burst (eye aspect ratio / yaw from landmarks), with a one-time challenge token that expires in 15 seconds.
3. For group photos, run the passive check only when the face crop is large enough; otherwise mark "liveness_not_checked" and send to review.
4. Add a spoof test mode over the spoof/ folder that prints APCER and BPCER.
5. Update tests and README.

## Additional task — classroom recognition

(Paste the Master Prompt first.)
TASK: Improve recognition on classroom photos and live frames.
- Tiled detection with overlap and NMS for large images, plus automatic upscaling when faces are small; configurable.
- Multi-frame fusion for live capture with per-student voting.
- A teacher-only debug view (off by default) showing detected boxes, scores and decisions.
- Run heavy processing in a threadpool or background task so the UI never freezes; show progress.
- Add timing logs, benchmark on CPU and put time per image in the README.

## Additional task — analytics

(Paste the Master Prompt first.)
TASK: Add an analytics dashboard for Teacher and Admin using Recharts.
Charts: attendance % per section over time; per-session attendance rate; attendance by weekday; at-risk students table (below limit or trending down) with CSV export; review-queue stats (auto vs manual vs unknown); corrections by reason.
Add a seed option that generates 20 past sessions of clearly labelled DEMO data so charts are not empty in demos.

## Additional task — security

(Paste the Master Prompt first.)
TASK: Audit and harden security and privacy across the project.
Check: embedding encryption and key handling; embeddings and thumbnails never exposed to the wrong role; JWT expiry and role checks on every route; login rate limiting; CORS; upload size and type limits; thumbnail auto-deletion job; consent revoke and delete flow; audit log has no update or delete endpoints; logs never print biometric data.
Fix every issue found, add tests, and write docs/PRIVACY.md (what biometric data is stored, how it is protected, retention, student rights).

## Additional task — QR

(Paste the Master Prompt first.)
TASK: Add optional QR + face two-factor check-in.
The teacher screen shows a QR code that rotates every 30 s (signed token with session id and timestamp). The student opens a phone page, scans or enters the code, then does a webcam face check with the liveness challenge. Mark present only if both pass. Add a per-session toggle "require QR". Include replay protection (one check-in per student per session, token valid for one window only) and tests.

## Additional task — judges' documentation

(Paste the Master Prompt first.)
TASK: Write the documentation pack for the judges.
1. Project report: problem, architecture, the full pipeline explained step by step, privacy design, evaluation method, results (leave clearly marked placeholders for MY real numbers from evaluation/results/summary.md), limitations, future work.
2. Mermaid diagrams: system architecture, recognition pipeline, ER diagram, review flow.
3. A 10-slide outline with speaker notes.
4. A 5-minute live demo script and a backup plan.
5. 25 likely viva questions with short answers (threshold choice, FAR vs FRR, why embeddings, liveness limits, bias and fairness, consent).
Be honest about limitations. Do not invent results.

## Reusable future debugging template

(Paste the Master Prompt first.)
Problem: <what I did and what I expected>
Error / traceback: <paste the full text>
Relevant files: <paste their contents>
Fix the root cause, show only the changed files in full, and explain in 2-3 sentences what was wrong.

## Final user instruction

project run korte hobbe na, just amake fulll project creat kore dao. akdom full.

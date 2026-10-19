# PUB AttendEye

A complete-source university hackathon prototype for Track B4: consent-based face attendance, teacher review, encrypted biometrics, optional QR + face check-in, analytics and reproducible evaluation. Designed for one CPU-only Windows 10/11 or Linux laptop, a 3–4 person team and a ten-day hackathon.

**Delivery status:** source files and static syntax checks only. At the user's request, the app, dependency installation, tests, model inference and benchmarks were **not run**. No accuracy or CPU performance numbers are claimed. Model binaries, secrets, databases and volunteer datasets are intentionally not bundled. Complete the setup below and verify on your target laptop before presenting it as working.

## What's included

- FastAPI backend with SQLAlchemy 2, Pydantic v2, SQLite, JWT, direct bcrypt and Fernet.
- CPU InsightFace alignment/512-dimensional embeddings; tiled/upscaled detection and NMS.
- Quality gates, section-restricted galleries, maximum sample cosine, Hungarian matching and frame voting.
- MiniFASNetV2 ONNX passive liveness with a download/export script; conservative fallback.
- User/session-bound one-time 15-second blink or head-turn challenges.
- Optional 30-second rotating QR plus live face check-in with replay prevention.
- Student consent, five-pose enrolment, attendance alerts and biometric deletion.
- Teacher capture, bounding boxes, review, corrections, closure, PDF/CSV exports and analytics.
- Admin user/course/section/roster/assignment CRUD and global threshold settings.
- Clearly fake seeded accounts; optional twenty explicitly labelled DEMO past sessions.
- Real-data evaluation scripts, synthetic pytest tests, privacy/consent materials and judges' documentation.

## Project map

The exact full tree is in `FILE_TREE.txt`. Key directories:

```text
attendeye/
  backend/
    app/
      main.py
      config.py
      database.py
      models.py
      schemas.py
      security.py
      deps.py
      routers/
      services/
    scripts/
    tests/
    .env.example
    requirements.txt
    pytest.ini
  frontend/
    src/
      pages/
      components/
      api/
    package.json
    vite.config.js
    tailwind.config.js
    postcss.config.js
    .env.example
    index.html
  evaluation/
    evaluate.py
    metrics.py
    benchmark.py
    README.md
    consent_form.md
    data_collection_checklist.md
  docs/
    MASTER_PROMPT.md
    REPORT.md
    DIAGRAMS.md
    SLIDES.md
    DEMO_SCRIPT.md
    VIVA.md
    PRIVACY.md
    SECURITY_AUDIT.md
    TEAM_PLAN.md
    VERIFICATION.md
  requirements.txt
  README.md
```

## Requirements

Use **Python 3.10 or 3.11 (64-bit)** and a supported Node.js release compatible with Vite 6 (Node 22 is a suitable choice). A webcam is optional for photo-only demonstrations. Internet is needed initially for dependencies and model downloads; cached models can run offline afterwards. CPU-only ONNX Runtime is used; CUDA is not needed.

InsightFace 0.7.3 includes a native extension. On Windows install Microsoft Visual C++ Build Tools with “Desktop development with C++” and the Windows SDK if a wheel cannot be built. On Debian/Ubuntu install `build-essential` and the matching Python development headers. Use a virtual environment rather than a system Python installation.

The required application stack is retained. Supporting packages are Pillow (EXIF/image decoding), python-multipart (uploads), python-dotenv (environment files), matplotlib (requested plots), httpx (tests), and qrcode.react (QR rendering). `torch` and `onnx` are optional **model-export-only** dependencies; the running app uses ONNX Runtime, not PyTorch. No passlib is used.

## Windows 10/11 setup (PowerShell)

Extract the ZIP, open PowerShell in `attendeye`, and run these commands when you are ready:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
python -m pip install numpy==1.26.4 Cython==0.29.37
python -m pip install --no-build-isolation -r requirements.txt
python scripts/init_env.py
python scripts/seed.py --demo-sessions
python scripts/download_face_model.py
```

If your machine uses Python 3.10, replace `py -3.11` with `py -3.10`. If PowerShell activation is restricted, use the virtual environment interpreter directly, such as `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`; changing machine-wide execution policy is unnecessary.

Install the optional stronger passive model before attempting automatic live/QR acceptance:

```powershell
python -m pip install torch==2.5.1 onnx==1.17.0
python scripts/download_minifas.py
```

Start the backend in the same terminal:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

In a second PowerShell terminal opened in `attendeye`:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. API documentation is at `http://127.0.0.1:8000/docs` after startup. Swagger's UI assets may require internet even when the app itself can work offline.

## Linux setup (Bash)

Install Python 3.10/3.11 with venv/development support and build tools using your distribution's package manager. Then, from `attendeye`:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install numpy==1.26.4 Cython==0.29.37
python -m pip install --no-build-isolation -r requirements.txt
python scripts/init_env.py
python scripts/seed.py --demo-sessions
python scripts/download_face_model.py
python -m pip install torch==2.5.1 onnx==1.17.0
python scripts/download_minifas.py
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Use `python3.10` if that is your installed supported interpreter. In another terminal:

```bash
cd attendeye/frontend
npm install
npm run dev
```

Always run backend scripts from `backend/`; relative database, model and private paths are resolved from that working directory. Do not use multiple Uvicorn workers. No dependency install, application start or model download was performed by the project generator.

## Secrets and demo login

`scripts/init_env.py` creates `backend/.env` with a random JWT secret, Fernet key and seed password, and refuses to overwrite an existing file. Open it privately to read `SEED_PASSWORD`; do not screen-share or commit it.

| Account | Email |
|---|---|
| Admin | `admin@demo.invalid` |
| Teachers | `teacher1@demo.invalid`, `teacher2@demo.invalid` |
| Eight fake students | `student1@demo.invalid` through `student8@demo.invalid` |

All seeded accounts use the locally generated `SEED_PASSWORD`. Names, student codes, courses and sections are clearly labelled DEMO. No embeddings, photos or assumed consents are seeded. `--demo-sessions` creates twenty synthetic closed sessions total, split between two courses; repeated invocation does not duplicate them. Analytics excludes DEMO sessions until its checkbox is enabled.

For actual volunteers, create new accounts and separate real courses/sections. Assign teachers and populate the whole roster **before the first session**. Rosters freeze once a section has a session because the requested schema has no enrolment effective dates. Use a new section for a changed roster. Related historical data can prevent deleting an account or academic record; this preserves audit and percentage integrity.

## Models and liveness

`FACE_MODEL=buffalo_l` is the default. `download_face_model.py` loads/downloads the configured pack to `MODEL_ROOT`. Ensure it has detection, recognition and 3D 68-point landmarks. The engine uses the landmarks for pose and active motion. Do not swap models with an existing gallery: delete/re-enrol biometrics and retune. A stored model-name guard blocks accidental cross-pack use; operators must also avoid silently replacing weights within the same pack name.

`download_minifas.py` retrieves the official Silent-Face-Anti-Spoofing MiniFASNetV2 architecture/checkpoint at a resolved commit and exports ONNX. It writes a provenance/checksum manifest and upstream licence alongside the model. You can supply `--revision` with a full official commit SHA to reproduce the same source revision. This is one model, **not** the upstream two-model ensemble. It uses BGR float32 input in 0–255, NCHW 80×80, live class 1 and a 2.7-expanded crop.

If export/model loading fails, the app logs that it is using the texture/moire baseline. With `BASELINE_AUTO_ACCEPT=false` (default), the baseline sends observations to review and **will not complete automatic QR check-in**. The backend provides an authenticated `GET /liveness/status` endpoint and UI status badges indicating whether `minifas` or `baseline` is currently active. Installing/calibrating MiniFASNet is needed for the stronger automatic path. Setting the baseline flag true is a deliberate weak experimental mode, not an equivalent anti-spoof guarantee.

For large group photos, faces smaller than `PASSIVE_MIN_SIZE` are marked `liveness_not_checked` and cannot auto-present. Live captures require an ordered random blink or head-turn challenge plus at least two eligible agreeing votes. Burst frame intervals are adaptive (~160 ms for fast blink motions, ~320 ms for head turns). Sparse blink frames, pose sign, camera orientation and model domain shift need hands-on calibration. Challenge expiry is checked when submitted/claimed, before expensive inference; a valid admitted request may finish after the expiry time.

## Main workflow

1. Admin creates courses, sections, users, teacher assignments and enrolments. The admin page supports creation, updates and safe deletes.
2. Student reads and ticks the consent notice. The timestamp and version are saved.
3. Student captures one sample per front/left/right/up/down pose; five to ten samples are allowed. One-face, blur, light, size, signed pose gates (verifying direction of turn/tilt), and identity-consistency checks reject unsuitable samples. All five pose labels are required for gallery eligibility. To prevent proxy enrolment, a teacher or staff member should supervise the student's initial enrolment.
4. Teacher creates an open session with timezone-aware start/end times. The UI sends UTC and displays local time. Sessions last at most twelve hours.
5. Teacher affirms every pictured person's consent, then uploads a photo or starts an eight-frame live challenge. Processing is in a worker thread; UI capture counts and an indeterminate processing indicator stay responsive.
6. Review uncertain faces. Confirm/select/reject with a reason. Crops expire and are deleted on resolution; unresolved reviews remain without the expired crop.
7. Close the session to create absent records where no record exists. Students see per-section attendance under their course code. Corrections update alerts and append an audit row; automatic capture never replaces a manual decision.
8. Download CSV/PDF reports, inspect trends and at-risk tables. CSV export escapes leading spreadsheet formula characters.

A teacher-only debug checkbox appears when `DEBUG_RECOGNITION=true`; default is false. It adds similarity scores/margins to box decisions. Admin/student roles cannot request this debug mode. Standard teacher results still show boxes, accepted identities and review decisions as required.

## Optional phone QR + face

Create a session with “Require QR + face check-in.” The teacher screen displays a rotating signed QR refreshed every 30-second window.

To prevent submission failures when a student scans near the end of a 30-second window, the system uses a **start-and-complete check-in protocol**:
1. When the student scans or inputs the raw QR, the frontend immediately calls `POST /checkin/start`.
2. The server verifies the raw QR against the current 30-second window and issues a short-lived (15-second) signed `checkin_ticket` bound to the student, session, challenge, and an ephemeral database nonce.
3. The student prepares camera and completes the face challenge within the 15-second ticket lifetime (shown with a live countdown timer in the UI).
4. `POST /checkin/{session_id}` receives the ticket, challenge response, and burst frames. It atomically marks the ticket as used, validates challenge motion, passive liveness, and multi-frame recognition against the student's enrolled gallery.

A ticket reservation alone never marks attendance. One student/session redemption is strictly enforced by unique database constraints. A used or expired ticket/challenge cannot be retried; failure requires requesting a fresh start. Standard teacher photo/review/correction routes do not bypass QR-required presence.

`localhost` on a phone is the phone, not the laptop. Phone getUserMedia requires **HTTPS with a certificate trusted by that phone**. To use an already-provisioned trusted development certificate, copy `frontend/.env.example` to `.env`, set `DEV_HOST=0.0.0.0`, and set the absolute `TLS_CERT_FILE` and `TLS_KEY_FILE` paths. Use the laptop's certificate-covered LAN address and the Vite `/api` proxy; keep the backend on loopback. Limit firewall access to the demo network. QR token relay and camera-frame injection remain possible. For a pure localhost demo, use another browser profile on the laptop instead.

## Configuration

| Setting | Default / purpose |
|---|---|
| `DATABASE_URL` | SQLite in backend working directory |
| `JWT_SECRET`, `FERNET_KEY` | Required generated secrets |
| `JWT_MINUTES` | 60-minute login expiry |
| `CORS_ORIGINS` | Explicit localhost UI origins |
| `ALLOWED_HOSTS` | Localhost/127.0.0.1 |
| `FACE_MODEL`, `MODEL_ROOT` | buffalo_l and local cache |
| `DET_SIZE` | 640 detector input |
| `TILED_DETECTION`, `TILE_SIZE`, `TILE_OVERLAP` | Enabled, 1000 px, 0.25 overlap |
| `UPSCALE_SMALL_FACES` | Enabled; additional 2× tiles |
| `MIN_FACE_SIZE`, `MIN_BLUR`, `MIN_BRIGHTNESS`, `MAX_POSE` | Native quality gate settings |
| `MAX_UPLOAD_MB`, `MAX_REQUEST_MB`, `MAX_IMAGE_PIXELS` | 8 MB/image, 66 MB/request, 16 MP |
| `MINIFAS_PATH`, `MINIFAS_THRESHOLD`, `MINIFAS_SCALE` | Model path, 0.80, 2.7 |
| `PASSIVE_MIN_SIZE` | 80 native pixels |
| `BASELINE_AUTO_ACCEPT` | False; conservative fallback |
| `PRIVATE_DIR` | Encrypted temporary thumbnails |
| `DEBUG_RECOGNITION` | False; teacher-only debug |

Admin-managed database settings: attendance_limit=75, t_low=0.35, t_high=0.50, margin=0.05. These are starting values, not measured optimum settings.

For PostgreSQL later, install `psycopg[binary]` and set a `postgresql+psycopg://` DATABASE_URL. Tables use portable SQLAlchemy types and constraints. Changing the URL does **not** migrate SQLite data; plan a migration and run all integration tests. Single-worker locks still apply.

## Tests, evaluation and timing — run these yourself later

From the backend virtual environment:

```bash
python -m pytest
```

Tests use temporary databases, generated test keys, synthetic embeddings and mocked inference. They do not download face models. They cover matching/thresholds/votes, attendance percentages and corrections, consent/deletion, role boundaries, JWT expiry, thumbnail expiry, upload checks, liveness motion and QR replay. Real model/camera behaviour requires separate validation. There is no fabricated “tests passed” claim.

Follow `evaluation/README.md` to collect the separately consented dataset. From `backend/`:

```bash
python ../evaluation/evaluate.py --dataset ../evaluation/dataset --enrolled ../evaluation/enrolled.txt --spoof ../evaluation/spoof --group ../evaluation/group --group-labels ../evaluation/group_labels.csv --out ../evaluation/results
python ../evaluation/evaluate.py --dataset ../evaluation/dataset --spoof ../evaluation/spoof --spoof-only
python ../evaluation/benchmark.py ../evaluation/group/class01.jpg --runs 5 --out ../evaluation/results/benchmark.json
```

The evaluator fails with a clear message when required folders/labels are missing. It writes metrics.csv, per_condition.csv, ROC/DET PNGs and summary.md only from actual input. Unknown identities must be absent from enrolled.txt. Exact group detection recall needs optional bounding-box labels; identity-only CSV produces a clearly labelled count proxy instead.

**CPU time per image: NOT MEASURED.** No project or benchmark was run at the user's request. `benchmark.py` reports real warm mean/p95 seconds per image and hardware metadata when executed. The API separately returns measured processing `elapsed_ms` on each capture. Insert your measured values into the judges' report; do not use DEMO chart data as recognition evidence.

## Cleanup and retention

While running, a one-minute cleanup sweep removes expired/resolved encrypted crops; reads refuse expired crops immediately. Startup also cleans expired files. If the server is off, use `python scripts/cleanup.py` from the backend directory through Windows Task Scheduler or cron for continued deletion. Configure the scheduler's working directory and virtual environment interpreter explicitly. Full-disk encryption and backup retention remain the organiser's responsibility.

`DELETE /enrol/me` removes the student's vectors, revokes consent, and conservatively purges temporary review crops/candidate lists. It does not delete attendance history or independently collected evaluation photographs. See `docs/PRIVACY.md`.

## Troubleshooting

- **InsightFace compile failure:** use Python 3.10/3.11 x64, install C++ tools/headers, preinstall NumPy and Cython, then use the documented no-build-isolation install. Do not install an untrusted unofficial wheel.
- **No automatic attendance:** inspect quality/liveness review reasons, complete all poses, enrol the student in the correct section, check thresholds and active model. Baseline defaults to review-only.
- **Enrolment pose rejected:** use a slight turn/tilt (approx 10–15°), not an extreme angle; correct lighting and distance. Left/right (yaw) and up/down (pitch) checks enforce signed direction in mirror-webcam coordinates (yaw >= +10° for left turn, <= -10° for right turn; pitch <= -8° for tilt up, >= +8° for tilt down). Verify mirroring and orientation on target camera hardware before high-stakes deployment.
- **Challenge fails:** request a fresh token; start straight/open-eyed, make the requested motion, return to centre/open eyes. All tracked identities must remain consistent; group live motion is conservative.
- **Session time error:** check local/UTC conversion and current start/end window. Model processing can outlast the window after a valid submission.
- **Slow CPU:** reduce image resolution, reduce tile count or disable tiling/upscaling after measuring the detection trade-off. 2× tile upscaling now only triggers when native detection detects zero faces. Do not invent a latency target.
- **Photo too large:** resize before upload; limits protect RAM. Eight frames must fit the total request limit.
- **Cannot delete roster/user:** retained history references it. Use a new section; biometric withdrawal is separate from account deletion.
- **Session token persistence:** Tokens are retained in `sessionStorage` (scoped to browser tab lifetime, surviving page refreshes within the tab, cleared on tab close, logout, or 401 response). Active session validity is checked against `/auth/me` on mount.
- **Corrupt/unreadable embeddings after key change:** restore the original key from a protected backup or delete/re-enrol. Replacing a key without re-encryption is not rotation.
- **Phone camera unavailable:** use trusted HTTPS; plain LAN HTTP is insufficient.

## Judges' pack and upstream sources

Read `docs/REPORT.md`, `DIAGRAMS.md`, `SLIDES.md`, `DEMO_SCRIPT.md`, `VIVA.md` and `TEAM_PLAN.md`. The source-of-truth prompt is preserved in `docs/MASTER_PROMPT.md`. Real-result insertion fields appear only where explicitly requested in the report, not as fake measured values.

Primary sources used for model contracts and dependency/security review:

- [InsightFace Python package and model licensing](https://github.com/deepinsight/insightface/tree/master/python-package). Library code and pretrained-weight licences differ; bundled pretrained packs are described upstream as non-commercial research models. Verify permission for your exact use before distribution/deployment.
- [Silent-Face-Anti-Spoofing](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing), [prediction contract](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/master/src/anti_spoof_predict.py), and [MiniFASNet architecture](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/master/src/model_lib/MiniFASNet.py).
- [Starlette release notes](https://www.starlette.io/release-notes/) for multipart spool behaviour/security updates.
- [Vite Windows path advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff), fixed in the selected 6.4.3 branch release.
- [Axios releases](https://github.com/axios/axios/releases) for maintained HTTP-client security fixes.

Dependency pins are a source snapshot, not a resolved cross-platform lockfile. The generator did not run package installation or a package advisory scanner. After validating on your platforms, retain npm's generated lockfile and a tested Python environment snapshot for reproducibility.

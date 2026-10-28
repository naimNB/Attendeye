# Release Checklist & Final Stabilization Report: PUB AttendEye

**Target Project:** PUB AttendEye  
**Scope:** Feature Freeze & Pre-Dockerization Stabilization  
**Date:** 2026-10-28  
**Python Runtime:** `/home/mdnaim/miniconda3/envs/cv/bin/python` (Python 3.10.16)  
**Node Runtime:** Node.js 22.x / Vite 6.4.3  
**Verdict:** **READY FOR DOCKERIZATION**

---

## 1. Executive Summary

PUB AttendEye has achieved feature freeze and full stabilization at its current implemented scope. All core workflows across the Student, Teacher, and Administrator portals have been verified end-to-end against local source code, database models, cryptographic services, and automated regression tests.

- **Automated Backend Tests:** 80 / 80 passed (100% pass rate).
- **Automated Frontend Tests:** 15 / 15 passed (100% pass rate).
- **Production Asset Build:** Built cleanly in 4.19s without errors.
- **Whitespace / Git Tree Check:** `git diff --check` passed cleanly.
- **Database Migrations:** Non-destructive room migration verified.
- **Dockerization Status:** Pre-flight requirements verified; handoff specifications documented in `docs/DOCKER_HANDOFF.md`.

---

## 2. Completed Functional Scope

### 2.1 Multi-Portal Architecture & Navigation
- **Landing Page (`/`):** Unified portal navigation hub with clear, professional design, routing users to `/student`, `/teacher`, or `/admin`. Legacy route `/login` cleanly redirects to `/`.
- **Institutional Branding & Styling:** Professional dark navy sidebars, light slate page backgrounds, teal accents, generous whitespace, accessible SVG icons, and zero emojis/decorative symbols.
- **Consistent Product Identity:** "PUB AttendEye" is applied consistently as the official product title across all portal headers, page titles, navigation sidebars, and footer notes.
- **Purged Demo Wording from Public Pages:** All demo credential instruction cards, pre-filled demo account buttons, and promotional/hackathon copy have been removed from normal login and landing screens (`PortalLogin.jsx`, `Login.jsx`, and `Layout.jsx`). Form placeholders use institutional formats (`name@university.edu`).
- **Demarcation of Synthetic Records:** Demo indicators (`<Badge variant="demo">DEMO</Badge>`) are strictly retained on synthetic class sessions and seeded demo courses. Analytics excludes synthetic records by default (`include_demo=false`), providing an administrator checkbox with an amber disclaimer banner when enabled.
- **Portal Session Isolation:** `sessionStorage` keys are scoped per portal (`student_token`, `teacher_token`, `admin_token`) to prevent credential collisions when testing multiple roles in separate tabs.

### 2.2 Administrator Management & Governance
- **Course & Section Setup:** Full management of course codes, course titles, section names, and default room/location assignments.
- **Registration Approval Gate:** Student and teacher self-registrations default to `status = 'pending'`. Administrators inspect institutional ID and name before approving or rejecting accounts.
- **Teacher Section Assignments:** Strict assignment of approved teachers to course sections, with duplicate prevention and validation that unapproved teachers cannot be assigned.
- **Student Section Enrolment:** Assignment of approved students to course sections, with duplicate protection and rejection of unapproved or non-existent accounts.
- **Roster Freezing Policy:** Once a section has held an active or historical class session, the enrolment roster is automatically frozen (`roster_frozen = true`). Attempts to add or remove students return HTTP 409 Conflict to preserve historical record integrity. Section room and title updates remain permitted.
- **Institutional Analytics:** Comprehensive analytics aggregating attendance rates across sections and highlighting at-risk students below threshold (e.g. 75%). Synthetic `[DEMO]` sessions are excluded by default to avoid polluting production reports.

### 2.3 Student Onboarding & Privacy-First Biometrics
- **Registration & Approval:** Institutional signup records student ID and name. Account remains pending until administrator approval.
- **Biometric Consent:** Mandatory, informed consent form explaining face vectorization and encrypted storage. Consent timestamp and policy version (`v1.0`) are recorded.
- **Guided 5-Pose Enrolment:** Webcam-guided capture of 5 distinct facial poses: Front, Left (yaw >= +10°), Right (yaw <= -10°), Up (pitch <= -8°), and Down (pitch >= +8°).
- **Enrolment Quality Gates:** Automated rejection of frames with blur, poor illumination, multiple faces, off-angle head tilts, or identity discontinuity.
- **Fernet Vector Encryption:** 512-dimensional facial embedding vectors are encrypted using Fernet (AES-128-CBC + HMAC-SHA256) before database storage. Raw enrolment images are **never persisted to disk or database**.
- **Instant Biometric Deletion:** Students can trigger `DELETE /enrol/me` anytime. This permanently purges encrypted vector records, revokes biometric consent, and cleans pending review crops. Historical attendance percentages and audit logs are preserved for university records.

### 2.4 Teacher Session Lifecycle & Classroom Attendance
- **Session Scheduling:** Creation of open class sessions with UTC timestamp conversion, time-window validation, and room location overrides.
- **Two-Factor Rotating QR Check-in:**
  - Teacher console projects a signed QR code refreshed every 30 seconds.
  - Student scans QR and immediately claims a 15-second signed `checkin_ticket` bound to student ID, session ID, and active liveness challenge nonce.
  - Student completes the 15-second active liveness challenge (blink or head turn).
  - Backend verifies challenge motion, validates identity continuity across 5–8 frames, matches against section gallery, and marks attendance atomically.
  - One-time ticket and challenge tokens prevent replay attacks and token relay.
- **Group Photo & Burst Capture:**
  - Teacher uploads lecture hall photos or captures webcam bursts.
  - Multi-tile upscaling (1000px tiles with 25% overlap) detects small faces in large lecture halls.
  - Hungarian algorithm matches detected embeddings to enrolled gallery vectors.
  - Unanimous or high-confidence matches are automatically marked `present`.
- **Manual Review & Ambiguous Match Resolution:**
  - Ambiguous matches or borderline similarity scores generate `ReviewItem` entries.
  - Thumbnails are stored encrypted on disk under `private/` with a 48-hour expiration.
  - Teacher resolves reviews by confirming candidate, choosing another enrolled student, or rejecting.
  - Resolving a review immediately deletes the encrypted thumbnail from disk.
- **Session Closure & Audit Log:**
  - Closing a session automatically writes `absent` records for all unrecorded roster students.
  - Manual status corrections require a mandatory reason and append immutable rows to `audit_log`.
  - CSV report exports escape spreadsheet formulas (`=`, `+`, `-`, `@`, `\t`, `\r`) to prevent formula injection attacks. PDF attendance sheets provide printable records.

---

## 3. Confirmed Defects & Security Gaps Resolved

During this stabilization phase, several security, concurrency, and validation defects were identified and resolved:

| ID | Component | Defect Description | Resolution Applied | Verification Test |
|---|---|---|---|---|
| **SEC-01** | `recognition.py` | `gallery_for()` allowed non-approved, suspended, or unconsented students to be included in face recognition galleries. | Restricted gallery queries strictly to `role == 'student'`, `status == 'approved'`, active section enrolment, and valid biometric consent. | `test_recognition_authorization.py` |
| **SEC-02** | `recognition.py` & `checkin.py` | Potential race condition: student could be suspended or consent revoked while heavy inference was executing. | Revalidated fresh student eligibility immediately before writing attendance records in `capture()` and `checkin()`. | `test_stale_eligibility_during_inference` |
| **SEC-03** | `recognition.py` | `capture()` did not verify whether class session scheduled time window had expired before recording attendance. | Added explicit validation that session is `status == 'open'` and `starts_at <= now() <= ends_at`. | `test_capture_rejects_expired_session` |
| **SEC-04** | `checkin.py` | Ticket token and challenge token were not cryptographically bound together, allowing challenge reuse. | Added challenge ID (`cid`) claim to `checkin_ticket` and verified `t_data['cid'] == chal_data['cid']`. | `test_checkin_ticket_challenge_binding` |
| **SEC-05** | `checkin.py` | Validation ordering caused challenge token decoding before ticket expiration and duplicate checkin validation. | Reordered validation precedence: (1) ticket/QR expiry, (2) duplicate check-in, (3) ticket-challenge CID binding, (4) challenge token consumption. | `test_expired_ticket...` & `test_duplicate_checkin...` |
| **SEC-06** | `privacy.py` | Unhandled `OSError` if a background thumbnail cleanup thread attempted to delete a file simultaneously deleted by review resolution. | Added `try...except OSError: pass` guard in `cleanup()` around `path.stat()` and `path.unlink()`. | `test_privacy_cleanup` |
| **SEC-07** | `attendance.py` | Review candidate suggestions could include students outside the session's section. | Enforced section boundary filtering when querying candidates for manual review resolution. | `test_section_isolation_and_onboarding.py` |

---

## 4. Verification Test & Build Results

### 4.1 Backend Pytest Suite
- **Command:** `cd backend && /home/mdnaim/miniconda3/envs/cv/bin/python -m pytest tests/`
- **Output Summary:**
  ```text
  ........................................................................ [ 90%]
  ........                                                                 [100%]
  =============================== warnings summary ===============================
  80 passed, 1 warning in 64.28s (0:01:04)
  ```
- **Test File Coverage:**
  - `test_auth_error_handling.py`: JWT expiration, error header propagation, invalid tokens.
  - `test_liveness_qr.py`: Rotating QR, challenge tickets, duplicate check-in, liveness motion.
  - `test_recognition_authorization.py`: Gating of suspended, unapproved, unconsented students.
  - `test_section_isolation_and_onboarding.py`: Roster integrity, admin onboarding, section isolation.
  - `test_services.py`: Face quality, blur, illumination, Fernet vector encryption, matching algorithms.
  - `test_routes.py`: Attendance calculations, session lifecycle, report exports, audit logging.

### 4.2 Frontend Unit Tests
- **Command:** `cd frontend && npm test`
- **Output Summary:**
  ```text
  > pub-attendeye@1.0.0 test
  > node --test

  ✔ AUTH_FAILURE_CODES contains all access-token failure codes (0.946164ms)
  ✔ getErrorCode extracts code from detail object, data.code, or headers (0.163208ms)
  ✔ isAuthFailure returns true only for actual authentication failures (0.123536ms)
  ✔ isAuthFailure returns false for QR, challenge, and ticket expiry (0.142566ms)
  ✔ isAuthFailure returns false for incorrect login credentials (0.134511ms)
  ✔ isAuthFailure returns false for non-401, network, and permission errors (0.100879ms)
  ✔ errorText formats detail objects, strings, arrays, and fallbacks properly (0.152712ms)
  ✔ resolveActivePortal identifies portal from pathname (1.413427ms)
  ✔ scoped storage maintains strict isolation between portals (0.604156ms)
  ✔ WRONG_PORTAL status 403 does not trigger unauthorized logout handler (0.11112ms)
  ✔ formatAccountName displays Administrator for seeded default and preserves custom names (0.10116ms)
  ✔ ACCOUNT_SUSPENDED (403) during login does not trigger unauthorized logout handler (1.042746ms)
  ✔ ACCOUNT_UNAVAILABLE (401) on suspended token triggers session cleanup (0.261039ms)
  ✔ Pending account status is properly stored and read in portal session (0.304509ms)
  ✔ Approved account status retains institutional verification metadata (0.191244ms)
  ℹ tests 15
  ℹ suites 0
  ℹ pass 15
  ℹ fail 0
  ```

### 4.3 Frontend Production Build
- **Command:** `cd frontend && npm run build`
- **Output Summary:**
  ```text
  > pub-attendeye@1.0.0 build
  > vite build

  vite v6.4.3 building for production...
  ✓ 752 modules transformed.
  dist/index.html                     0.40 kB │ gzip:   0.28 kB
  dist/assets/index-BIAS4N1b.css     44.33 kB │ gzip:   7.48 kB
  dist/assets/index-CAsC9dVL.js   1,218.90 kB │ gzip: 346.38 kB
  ✓ built in 4.19s
  ```

### 4.4 Git Tree Whitespace Check
- **Command:** `git diff --check`
- **Output:** Clean (0 whitespace errors or conflicts).

---

## 5. Required Migrations

When running against an existing SQLite or PostgreSQL database that does not have the `room` column on `sections` and `class_sessions`:

```bash
cd backend
/home/mdnaim/miniconda3/envs/cv/bin/python scripts/migrate_rooms.py
```
*Note: This script safely inspects table columns via `PRAGMA table_info` and executes `ALTER TABLE ... ADD COLUMN` only if missing. It does not drop tables or modify existing attendance or vector data.*

---

## 6. Known Limitations Honestly Recorded

1. **Hardware Camera Attestation:** The web application accesses camera feeds via standard browser `navigator.mediaDevices.getUserMedia()`. Active motion challenges and passive texture analyses reject static photos and video replays, but cannot prevent hardware-emulated virtual cameras at the operating system level without specialized browser hardware attestation extensions.
2. **Deferred Email Verification:** As specified in hackathon track requirements, email verification links are omitted. Account legitimacy is enforced through administrator verification of institutional IDs during the approval phase.
3. **Single-Worker Uvicorn Execution:** To preserve CPU performance on resource-constrained hardware and prevent SQLite concurrency locks, backend execution must run with a single worker (`--workers 1`). Multi-worker deployments require moving to PostgreSQL and external worker task queues.

---

## 7. Manual Acceptance Checklist

Use this checklist for manual verification across all three user personas:

### Administrator Acceptance
- [ ] Log in at `/admin/login` using seeded credentials.
- [ ] Navigate to `/admin/dashboard` and verify pending registrations list.
- [ ] Approve a pending student; confirm status switches to `approved`.
- [ ] Create a new Course (`CS-301`) and Section (`Section A`, Room `Lab 402`).
- [ ] Assign an approved teacher to `Section A`. Confirm duplicate assignment is blocked.
- [ ] Enrol the approved student into `Section A`. Confirm duplicate enrolment is blocked.
- [ ] Navigate to `/admin/analytics`. Confirm `[DEMO]` sessions are excluded by default. Enable the checkbox to verify demo trends render.

### Student Acceptance
- [ ] Register a new student at `/student/signup`.
- [ ] Attempt login at `/student/login` before approval; confirm informative pending notice is shown.
- [ ] After administrator approval, log in at `/student/login`.
- [ ] Navigate to `/student/enrol`. Accept the informed biometric consent form.
- [ ] Follow 5-pose guided capture (Front, Left, Right, Up, Down). Confirm completion message.
- [ ] Check `/student/dashboard`. Confirm assigned course section is listed with 0% initial attendance.
- [ ] From student profile, test biometric deletion (`DELETE /enrol/me`). Confirm vectors are deleted and status resets to unconsented.

### Teacher Acceptance
- [ ] Log in at `/teacher/login` using seeded credentials.
- [ ] Navigate to `/teacher/sessions` and create an open session for assigned section.
- [ ] Enable "Require QR check-in" and open session console at `/teacher/sessions/:id`.
- [ ] Confirm rotating QR refreshes smoothly every 30 seconds.
- [ ] Upload classroom test photo or capture burst. Confirm face bounding boxes appear.
- [ ] If review items are generated, resolve them with confirm/select/reject actions.
- [ ] Close the session. Confirm unmarked roster students are marked `absent`.
- [ ] Correct an attendance record manually; provide reason and confirm audit log row is created.
- [ ] Download CSV and PDF attendance sheets. Verify CSV headers and formula escaping.

---

## 8. Dockerization Verdict

**Verdict:** **READY FOR DOCKERIZATION**

All technical specifications, runtime entry points, volume mounts, environment variable contracts, health check probes, and camera security constraints have been validated and documented in `docs/DOCKER_HANDOFF.md`. The codebase is ready for containerization.

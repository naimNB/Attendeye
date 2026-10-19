# Five-minute live demo and backup plan

## Preparation before judges arrive

- Set up Python/Node and install models on the actual laptop before the event; first-time model downloads require internet.
- Keep a private copy of the database and `.env` under the organiser's control. Never project `.env` or passwords.
- Obtain consent from all demo volunteers, complete their enrolment and verify all five pose labels.
- Keep the model backend name visible in server startup/first-use logs without showing credentials. State explicitly if only baseline fallback is active.
- Use one teacher account, one student account and two browser profiles/tabs. Refreshing clears memory-only login.
- Prepare a real open session within the current time window. Remember stored timestamps are UTC and the UI shows local time.
- Prepare a separately consented classroom photograph and an intentionally difficult photo for review. Do not claim they are representative evaluation data.
- Run tests and the camera workflow yourself before the demo. The delivered project was not executed during generation.
- If showing analytics, seed `--demo-sessions` and enable “Include DEMO data”; keep the banner visible.
- If showing phone QR, configure trusted LAN HTTPS in advance. Do not debug certificates during the five-minute presentation.

## Script

| Time | Action | Suggested narration |
|---|---|---|
| 0:00–0:30 | Show teacher dashboard and roles | “PUB AttendEye assists teachers with attendance. It runs on this CPU laptop and flags uncertainty for review.” |
| 0:30–1:05 | Show student consent and existing enrolment progress | “Students explicitly consent. We keep encrypted embeddings, not enrolment photos. Each enrolment covers five poses, and students can delete their biometric data.” |
| 1:05–1:45 | Open a current class session and capture a photo or live burst | “The gallery contains only this section's enrolled students. The API checks the time window, image quality and liveness before automatic presence.” |
| 1:45–2:30 | Show bounding boxes and a review item | “A low score, small margin, difficult face or failed liveness check goes here. The teacher chooses a roster member or rejects it, with a reason.” |
| 2:30–3:05 | Close the session; inspect records and one correction | “Closing fills missing attendance as absent. Corrections have an actor, previous state, new state and reason.” |
| 3:05–3:35 | Switch to student attendance and notifications | “The percentage uses closed sessions only. Below-limit alerts are recalculated after closure and corrections.” |
| 3:35–4:10 | Show analytics and export CSV/PDF | “This trend view is labelled DEMO when synthetic sessions are included. Reports follow the teacher's assigned sections.” |
| 4:10–4:40 | Explain optional QR flow or show prepared QR screen | “A current classroom token plus the logged-in student's live face is required. Tokens expire and a student cannot redeem twice.” |
| 4:40–5:00 | Show real evaluation summary or explicitly say not measured | “These are our actual measured results and limitations. If evaluation is incomplete, we claim implementation only, not an accuracy figure.” |

## Backup plan

**Camera permission fails:** use the separately consented classroom photo upload. Do not pretend an uploaded photograph passed an active challenge; it uses passive checks only.

**Model is missing or slow:** explain the logged backend and show review/manual workflow. The default fallback is deliberately review-only. Show a previously recorded, consented local demo only if it is clearly labelled as recorded; never describe playback as current inference.

**Network fails:** localhost app and cached models can operate offline. Use a laptop browser for QR code entry. Do not rely on external APIs or first-time downloads.

**QR window expires:** request the current code and a new challenge; do not extend the security window for the demo. If phone HTTPS fails, show the same flow in a second localhost browser profile and explain the phone secure-origin requirement.

**Liveness rejects a genuine volunteer:** demonstrate the conservative failure and explain that estimated landmarks and RGB spoof checks can fail. Do not disable the gate and still call the result secure. For a standard non-QR session, use the teacher review/manual correction workflow. For QR-required sessions, the factors must pass; create a separate standard session if a manual alternative is needed.

**No evaluation yet:** show the collection protocol, synthetic unit tests and result-generation commands. Say “not measured.” Never replace missing measurements with DEMO chart values or upstream performance claims.

**Last resort:** present the architecture, screen recording and source tree offline. Clearly distinguish implemented code, recorded behaviour and verified measurements.

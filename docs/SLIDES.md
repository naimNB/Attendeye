# Ten-slide outline with speaker notes

## 1 — PUB AttendEye

On slide: Project title; Track B4; “Consent-based classroom attendance with human review”; team names.

Speaker notes (20 seconds): “We built a CPU-only localhost prototype for a teacher to capture attendance, review uncertainty and keep an auditable record. It is an assistant, not an infallible identity system.”

## 2 — The classroom problem

On slide: Manual effort; proxy attendance risk; small/blurred classroom faces; need for correction.

Speaker notes (25 seconds): “The difficult part is not just detecting a face. We must decide whether it belongs to someone in this class, handle uncertainty, and preserve a student's ability to correct mistakes.”

## 3 — Three roles, one workflow

On slide: Student consent/enrol/view/delete; teacher capture/review/close; admin roster/settings.

Speaker notes (25 seconds): “The roster limits the search space. Students see only their own records. Staff access follows section assignments. Manual attendance remains available when someone declines biometrics.”

## 4 — Architecture

On slide: Architecture diagram from DIAGRAMS.md; browser → guarded API → CPU vision + encrypted storage.

Speaker notes (30 seconds): “React captures frames, FastAPI validates access, and CPU processing runs in a threadpool. We store encrypted embeddings, not raw enrolment photos. Review crops have separate temporary storage.”

## 5 — Recognition pipeline

On slide: Detection/tiling → quality → aligned embedding → passive liveness → roster matching → thresholds.

Speaker notes (40 seconds): “We normalise 512-dimensional embeddings and compare cosines. The identity score is the best score across their samples. Hungarian assignment prevents the same student being assigned to two faces in one image. Low confidence becomes review.”

## 6 — Liveness and optional two-factor check-in

On slide: MiniFASNet; baseline fallback; one-time random challenge; rotating QR; stated limitations.

Speaker notes (35 seconds): “Our one-time token expires in 15 seconds. The QR rotates every 30 seconds. Both are bound to a session and the student identity is checked server-side. These controls reduce simple misuse, but camera injection and responsive replay remain limitations.”

## 7 — Human review and privacy

On slide: Top-three candidates; mandatory correction reasons; encrypted crop expiry; withdrawal.

Speaker notes (30 seconds): “A teacher can correct a decision, and the system records who changed it and why. Biometric withdrawal removes embeddings. Uncertain crops cannot reliably be attributed, so we conservatively purge temporary crops on withdrawal.”

## 8 — Evaluation design and real results

On slide: Conditions, known/unknown identities, FAR/FRR, ROC/DET, APCER/BPCER; insert your actual figures only.

Speaker notes (40 seconds): “Thresholds are chosen on validation data and then frozen for testing. Report the number of volunteers, failures and denominators. If evaluation has not been run, say so. DEMO attendance is not accuracy evidence. Group detection recall needs annotated boxes.”

## 9 — Live demonstration and analytics

On slide: Session → capture → review → close → attendance and trend dashboard.

Speaker notes (35 seconds): “We will demonstrate a real workflow with consenting volunteers. The analytics can also show labelled DEMO sessions to illustrate trends. Recognition results and synthetic attendance are separate.”

## 10 — Limitations and next steps

On slide: Small faces, camera domain shift, small sample size, single-worker prototype; stronger liveness and broader validation.

Speaker notes (20 seconds): “Our contribution is a complete, explainable workflow with conservative uncertainty handling. The next step is rigorous local evaluation and stronger anti-spoofing, not claiming production readiness from a hackathon demo.”

Timing target: five minutes including brief transitions. Replace team names and actual evaluation figures only after preparation; no measured values are supplied in this outline.

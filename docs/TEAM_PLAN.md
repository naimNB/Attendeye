# Ten-day implementation and validation plan

| Day | Backend/CV owner | Frontend owner | Evaluation/docs owner | Integration gate |
|---|---|---|---|---|
| 1 | Install CPU environment and initialise keys | Install UI and verify login | Consent and dataset protocol | Two platforms can install |
| 2 | Seed roster, roles and enrolment | Student wizard | Recruit consenting volunteers | Consent → five poses |
| 3 | Detector, quality gates, encrypted gallery | Capture/result display | Capture enrol/probe sessions | No raw app enrolment files |
| 4 | Hungarian matching, review, closure | Review/correction UI | Label conditions and group identities | Correct scoped attendance |
| 5 | MiniFAS export and passive checks | Live prompt/progress | Collect bona-fide and spoof shots | Log active backend; inspect failures |
| 6 | Challenge/QR integration | QR scan/entry and teacher display | Annotate group boxes | Expiry/replay/identity negative cases |
| 7 | Reports and analytics | Charts and admin controls | Validation evaluation | Tune only on validation |
| 8 | Security tests and cleanup | Responsive/accessibility review | Freeze thresholds, final test | No test leakage; disclose failures |
| 9 | Platform smoke tests and CPU timings | Demo polish and offline backup | Report/slide update with real numbers | Rehearsed five-minute demo |
| 10 | Freeze code and backup | Final rehearsal | Privacy purge/submission review | Clean submission, consent honoured |

For four members, separate the backend and CV owners. For three, keep the scope conservative: reliable photo/review flow first, QR/active challenge as an explicitly optional demonstration. The supplied source implements the features, but integration and real-world validation still require your team's work on its actual hardware.

# Security and privacy source review

This is an implementation review, not an independent penetration test. The project, tests, model inference, dependency installation and network workflows were not executed during delivery. Synthetic tests are supplied for the operator to run later. No runtime success or security certification is claimed.

| Area | Implemented control | Remaining boundary |
|---|---|---|
| Embeddings | Fernet BLOBs; fixed 512-float contract; no serialisation route | Operator can access memory/key; disk encryption needed |
| Keys | Random local generator; fail-closed validation; ignored `.env` | No automatic rotation/migration service |
| Passwords | Direct bcrypt; 10–72 UTF-8-byte policy; hash never returned | Shared demo password must be changed before broader use |
| JWT | HS256 allowlist, expiry, purpose, jti; role re-read from database | No token revocation list; password changes do not invalidate already issued tokens |
| Login | Ten attempts/minute/client address | Single process; reverse proxy/IP attribution must be configured deliberately |
| Authorisation | Role plus assigned-section checks on staff data and thumbnails | Admin is trusted across all sections |
| CORS/hosts | Explicit origin allowlist, trusted hosts, loopback default | LAN/production requires trusted HTTPS and deliberate host config |
| Uploads | Bounded chunked bodies, MIME and decode format checks, byte/pixel limits | Memory usage can approach request limit; do not expose directly to the internet |
| Raw-image retention | RAM-only multipart spool threshold above request cap | Swap/crash dumps/browser screenshots outside application control |
| Thumbnails | Encrypted private files, guarded no-store access, expiry and cleanup | Physical deletion pauses during downtime unless OS cleanup is scheduled |
| Consent | Explicit version and timestamp before enrolment; revoke deletes vectors | Teacher affirmation cannot prove every captured person consented |
| Review | Candidate IDs only from class gallery; manual reason required | Human mistakes remain possible |
| Audit | Append-only API semantics; actor/status/reason | Database administrators can modify storage; no hash chain |
| Automatic overwrite | Existing records, especially manual corrections, preserved | Teacher must resolve corrections explicitly |
| Live challenge | Random prompt, 15-second expiry, subject/session binding, atomic one-use claim | Client-supplied frames are not hardware-attested |
| QR | 30-second window; purpose/session checks; unique student/session redemption | Token relay remains possible; not location proof |
| QR bypass | Standard capture/review/correction cannot create unverified QR presence | Operator may choose a separate standard session for a manual alternative |
| Race handling | Single-worker mutation lock; DB unique constraints; atomic challenge update | Multiworker/multihost deployment requires redesigned coordination |
| Reports | Role checks, fixed filenames, CSV formula neutralisation, XML escaping | Downloaded exports become the recipient's responsibility |
| Logging | Counts/backend/timing only; generic unexpected errors | Operators must avoid proxy body/header logs |
| Analytics | Section scoping; DEMO opt-in banner | At-risk labels are descriptive, not disciplinary recommendations |
| Evaluation | No synthetic claims; raw dataset excluded; explicit nonresponse metrics | Manual dataset consent, leakage and retention review still required |

## Tests supplied

`test_security.py` checks encryption, expiry/purpose, role/section boundaries, consent, deletion, thumbnail expiry, type/size validation, CORS, rate limiting and session windows. `test_liveness_qr.py` checks motion sequences, small crops, challenge binding/reuse, QR windows, duplicate check-in and a mocked complete two-factor path. `test_attendance.py` checks denominators, close behaviour, correction audit and automatic overwrite protection. Matching and evaluation tests use synthetic vectors/scores only.

## Operational review before demonstration

Run the tests on both intended platforms, inspect the active liveness backend, verify camera permissions/pose direction and exercise the UI end-to-end. Review current dependency advisories and update compatible pinned packages before any exposure beyond the localhost demo. Verify that the final submission contains no `.env`, real dataset, database, private crop, generated sensitive result or model binary. Keep only the code and public documentation in the project archive.

# PUB AttendEye privacy design

PUB AttendEye is a localhost hackathon prototype for consenting volunteers. The team must offer manual attendance and must not use experimental automated decisions for punishment or high-stakes access.

## Data inventory

| Data | Where | Protection | Retention / deletion |
|---|---|---|---|
| Name, email, role and optional student code | Database | Role-filtered API and OS permissions | Until account deletion is allowed by retained academic history |
| Password hash | Database | bcrypt, work factor 12; never returned | Account lifetime |
| Consent version, grant and revoke timestamps | Database | Student/admin process access; no public list | Retained as a record of consent/withdrawal |
| 512-dimensional face vectors | Database BLOB | Fernet authenticated encryption using an external key | Student deletes/revokes, or organiser's event retention deadline |
| Raw app enrolment and capture images | RAM during request | Bounded upload, no logging, no deliberate disk persistence | Discarded when request objects are released |
| Review face thumbnails (96×96) | Private `.enc` files | Fernet encryption; authenticated assigned teacher/admin route only | Removed on resolution or expiry; periodic sweep each minute while server is running |
| Candidate IDs and similarity suggestions | Database | Assigned teacher/admin access | Retained with review history, cleared conservatively on biometric withdrawal |
| Attendance, notifications and correction history | Database | Student sees self; staff sees assigned sections; admin manages all | Team's documented academic record policy; biometric deletion does not erase history |
| QR redemption and used challenge state | Database | Token purpose, expiry and user/session binding; no image content | Event retention deadline; challenge rows can be pruned administratively offline |
| Offline evaluation photographs | Separate local evaluation folders | Separately consented, encrypted drive, restricted access | Signed collection-specific deletion date |

Embeddings remain biometric personal data. Encryption is not anonymisation and similarity scores are not probabilities. Review thumbnails include people who may be unknown to the gallery, so the teacher must affirm consent for everyone captured. The software cannot determine consent from a face.

## Secrets and storage

Run `scripts/init_env.py` to create independent random JWT and Fernet secrets. `.env`, databases, model files, private thumbnails, datasets and results are ignored by Git. No usable secrets are bundled. Startup fails if secrets are missing or malformed. Keep `.env` readable only by the operator; use Linux file modes or Windows NTFS ACLs. Enable disk encryption (BitLocker/LUKS) and protect backups. Never send keys or database copies in a public issue.

The application uses Fernet for both embeddings and review crops. The master key is separate from the database but usually on the same laptop; a compromised operating-system account can access both. Losing the Fernet key makes stored data unreadable. Key rotation requires decrypting with the old key and re-encrypting every embedding and thumbnail in an offline maintenance process; do not simply replace the key on an existing database.

Multipart uploads are kept in memory up to the bounded request limit to avoid temporary raw-photo disk spooling. OS swap, crash dumps and hibernation can still contain process memory: full-disk encryption and OS controls are needed for stronger forensic protection. Browser previews exist only in the active page and are revoked on clearing or unmount; do not take screenshots without separate permission.

## Access and transport

JWTs use HS256, explicit purpose, expiry and a random token ID. Roles come from the current database user, not a client-provided role. The browser retains the access token in memory only; refresh requires signing in. Every data endpoint has authentication and role/section restrictions. The health endpoint and API schema are public operational metadata. No endpoint returns embeddings, encryption keys or password hashes.

Staff must be assigned to a section to inspect its sessions, reports, reviews or thumbnails. Admin has institution-wide access. Debug is off by default and, when enabled, restricted to the teacher role. Thumbnails are never mounted as static files and have no public URL. Responses are marked no-store.

CORS trusts explicit origins only. Default hosting binds to loopback. A phone on the LAN needs a trusted HTTPS origin for browser camera access and encrypted transport; do not expose this prototype directly to the internet. Configure allowed hosts/origins deliberately. Localhost HTTP is a development exception, not a network security design.

## Withdrawal and expiry

`DELETE /enrol/me` removes all of that student's embeddings and timestamps every active consent as revoked. It also purges all temporary review thumbnails and candidate lists, because candidate suggestions cannot reliably establish who appears in an unknown/misidentified crop. It preserves academic records and correction logs. A student can later give fresh consent and enrol again.

Expired thumbnails cannot be fetched after 24 hours. Physical deletion occurs on the next cleanup sweep (normally within 60 seconds while running), immediately on review resolution, or on startup after downtime. A stopped program cannot delete files; keep an OS-scheduled cleanup job if a strict wall-clock deletion deadline must continue while the API is off. `scripts/cleanup.py` supports that job. Encryption still applies during downtime. Copies in backups must also follow retention policy.

For offline evaluation withdrawal, the organiser removes the volunteer's enrolment/probe/spoof files, re-collects or removes group images containing them, and deletes controlled derivatives and backups. App withdrawal cannot automatically identify independently collected files on other drives. Explain this distinction before consent.

## Audit and known limitations

Manual changes require a reason and append an audit row with actor, prior/new status and time. No API updates or deletes audit rows. This is application-level append-only behaviour; an OS/database administrator can modify the database, and there is no cryptographic tamper-evident ledger. Account/roster deletion with related records is blocked by foreign keys. Rosters freeze after the first session so attendance denominators remain coherent.

Logs contain operational counts, backend names and elapsed time, never vectors, images, passwords, JWTs or candidate identities. Disable HTTP body/Authorization logging in any reverse proxy. The server assumes one Uvicorn worker; in-process locks and rate limits are not a distributed security control.

MiniFASNet and the texture baseline are imperfect RGB spoof checks. The baseline defaults to review-only. Blink/head-turn landmark checks can fail on genuine volunteers and may be defeated by responsive replay, injected frames or generated media. A signed one-time challenge proves server issuance and limits replay; it does not attest a physical camera. QR proves knowledge of a current classroom token, not physical location, and can be relayed. Two-factor mode cannot bypass its QR requirement through ordinary teacher review/correction routes.

Before real deployment, obtain appropriate institutional review, define the retention schedule and incident response contacts, validate accessibility/fairness, deploy HTTPS and durable shared rate limits, add migrations/backups/key rotation, and commission an independent security review.

# PUB AttendEye diagrams

## System architecture

```mermaid
flowchart TD
  Browser["React browser UI"] -->|"JWT and bounded images"| API["FastAPI role and section guards"]
  API --> Worker["CPU threadpool"]
  Worker --> Vision["InsightFace and MiniFASNet"]
  Worker --> Match["Hungarian matching and voting"]
  API --> DB["SQLAlchemy: SQLite"]
  Match --> DB
  API --> Private["Encrypted temporary crops"]
  Cleanup["Expiry cleanup"] --> Private
  Eval["Offline evaluator"] --> Vision
  Eval --> Match
```

## Recognition pipeline

```mermaid
flowchart TD
  Input["Authorised capture in time window"] --> Decode["Decode and fix orientation"]
  Decode --> Detect["Full image, tiles, upscale, NMS"]
  Detect --> Embed["Align and normalise embeddings"]
  Embed --> Gates{"Quality and passive check pass?"}
  Gates -->|No| Review["Review with reason"]
  Gates -->|Yes| Scores["Section gallery cosine matrix"]
  Scores --> Assign["Hungarian assignment with unmatched choices"]
  Assign --> Threshold{"High threshold and margin?"}
  Threshold -->|No| Review
  Threshold -->|Yes| Mode{"Photo or live?"}
  Mode -->|Photo| Present["Present unless QR is required"]
  Mode -->|Live| Vote{"Challenge and two frame votes?"}
  Vote -->|Yes| Present
  Vote -->|No| Review
```

## Entity relationships

```mermaid
erDiagram
  USERS ||--o{ CONSENTS : grants
  USERS ||--o{ FACE_EMBEDDINGS : owns
  USERS ||--o{ ENROLMENTS : joins
  SECTIONS ||--o{ ENROLMENTS : contains
  COURSES ||--o{ SECTIONS : offers
  USERS ||--o{ TEACHER_ASSIGNMENTS : teaches
  SECTIONS ||--o{ TEACHER_ASSIGNMENTS : authorises
  SECTIONS ||--o{ CLASS_SESSIONS : schedules
  USERS ||--o{ CLASS_SESSIONS : creates
  CLASS_SESSIONS ||--o{ ATTENDANCE_RECORDS : records
  USERS ||--o{ ATTENDANCE_RECORDS : receives
  CLASS_SESSIONS ||--o{ REVIEW_ITEMS : flags
  ATTENDANCE_RECORDS ||--o{ AUDIT_LOG : changes
  USERS ||--o{ AUDIT_LOG : authors
  USERS ||--o{ NOTIFICATIONS : receives
  CLASS_SESSIONS ||--o{ CHALLENGES : binds
  USERS ||--o{ CHALLENGES : requests
  CLASS_SESSIONS ||--o{ QR_REDEMPTIONS : accepts
  USERS ||--o{ QR_REDEMPTIONS : redeems
  USERS {
    int id PK
    string email UK
    string role
    string password_hash
  }
  SECTIONS {
    int id PK
    int course_id FK
    string name
  }
  FACE_EMBEDDINGS {
    int id PK
    int student_id FK
    bytes vector_encrypted
    string pose_label
  }
  CLASS_SESSIONS {
    int id PK
    int section_id FK
    int teacher_id FK
    datetime starts_at
    datetime ends_at
    bool require_qr
    bool is_demo
  }
  ATTENDANCE_RECORDS {
    int id PK
    int session_id FK
    int student_id FK
    string status
    string source
  }
  SETTINGS {
    string key PK
    string value
  }
```

The database also enforces unique student/session attendance, unique student/session QR redemption, and composite roster/assignment keys. Settings are global and intentionally have no foreign-key relationship.

## Review and correction flow

```mermaid
flowchart TD
  Flag["Flagged observation"] --> Pending["Pending review and encrypted crop"]
  Pending --> Action{"Assigned teacher decision"}
  Action -->|"Candidate or roster student"| QR{"QR-required session?"}
  QR -->|"No, or redeemed"| Record["Manual present and audit reason"]
  QR -->|"Yes, not redeemed"| Block["Require two-factor check-in"]
  Block --> Pending
  Action -->|Reject| Resolved["Resolve without present record"]
  Record --> Resolved
  Resolved --> Delete["Delete crop immediately"]
  Record --> Alerts["Recalculate percentage and alerts"]
  Pending -->|"24-hour expiry"| Expire["Delete crop; review remains pending"]
```

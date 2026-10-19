# Verification record

The user explicitly requested project creation without running it.

Performed:

- Parsed every Python source file with Python's AST parser, without importing/executing app modules.
- Parsed every JavaScript/JSX source and config file using a Babel parser already present in the authoring environment, without building or executing the UI.
- Parsed package.json as JSON.
- Reviewed source wiring, route guards, SQLAlchemy constraints, consent/revoke flow, challenge/QR binding, private thumbnail access and cleanup, and no-auto-overwrite behaviour.
- Checked that project packaging excludes secrets, real datasets, database files and model binaries.

Not performed:

- Dependency installation/resolution or platform-specific compile checks.
- pytest execution, app startup, HTTP integration, browser rendering or camera access.
- InsightFace or MiniFASNet download/export/inference.
- Dataset evaluation, anti-spoof validation, accuracy measurement or CPU benchmarking.
- Independent penetration testing, formal verification, or a complete dependency-advisory scan.

The included tests and setup steps are intended to be run by the team later. Static parsing proves syntax readability only, not end-to-end correctness or security. The README intentionally says CPU timing is not measured. No test-pass count, accuracy number or benchmark number has been invented.

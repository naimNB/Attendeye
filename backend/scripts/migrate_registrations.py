"""Non-destructive migration script for user registration and approval status.

Preserves existing user records, biometric enrolments, attendance history,
and session data. Existing accounts are classified as approved.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text
from app.database import engine, Base
import app.models  # ensure models registered with Base

NEW_COLUMNS = [
    ("status", "VARCHAR(20) DEFAULT 'approved'"),
    ("staff_id", "VARCHAR(50)"),
    ("department", "VARCHAR(100)"),
    ("batch", "VARCHAR(50)"),
    ("rejection_reason", "VARCHAR(500)"),
    ("verified_method", "VARCHAR(100)"),
    ("verified_by", "INTEGER REFERENCES users(id)"),
    ("verified_at", "DATETIME"),
]


def migrate(eng=engine):
    Base.metadata.create_all(eng)
    with eng.connect() as conn:
        dialect = eng.dialect.name
        if dialect == "sqlite":
            rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            existing_cols = {r[1] for r in rows}
            for col_name, col_type in NEW_COLUMNS:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
            conn.execute(text("UPDATE users SET status = 'approved' WHERE status IS NULL"))
            conn.commit()
        else:
            for col_name, col_type in NEW_COLUMNS:
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            conn.execute(text("UPDATE users SET status = 'approved' WHERE status IS NULL"))
            conn.commit()


if __name__ == "__main__":
    print("Applying registration and approval schema updates...")
    migrate()
    print("Migration complete. All existing users classified as approved.")

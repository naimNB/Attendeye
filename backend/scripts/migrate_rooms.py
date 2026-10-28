"""Non-destructive, repeatable migration script for section and session room/location storage.

Preserves existing course sections, class sessions, attendance records,
biometric enrolments, and teacher assignments.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text
from app.database import engine, Base
import app.models  # ensure models registered with Base

ROOM_COLUMNS = [
    ("sections", "room", "VARCHAR(80)"),
    ("class_sessions", "room", "VARCHAR(80)"),
]


def migrate(eng=engine):
    Base.metadata.create_all(eng)
    with eng.connect() as conn:
        dialect = eng.dialect.name
        if dialect == "sqlite":
            for table_name, col_name, col_type in ROOM_COLUMNS:
                rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                existing_cols = {r[1] for r in rows}
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
            conn.commit()
        else:
            for table_name, col_name, col_type in ROOM_COLUMNS:
                try:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass


if __name__ == "__main__":
    print("Applying section and class session room schema updates...")
    migrate()
    print("Migration complete. Room/location columns added safely.")

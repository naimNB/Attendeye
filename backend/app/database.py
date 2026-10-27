from collections.abc import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from .config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True,
                       connect_args={"check_same_thread": False, "timeout": 30}
                       if settings.database_url.startswith("sqlite") else {})
if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def configure_sqlite(connection: object, _: object) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as db:
        try:
            yield db
        except Exception:
            db.rollback()
            raise


def migrate_schema(eng=engine) -> None:
    from sqlalchemy import text
    with eng.connect() as conn:
        if eng.dialect.name == "sqlite":
            rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            if rows:
                cols = {r[1] for r in rows}
                new_cols = [
                    ("status", "VARCHAR(20) DEFAULT 'approved'"),
                    ("staff_id", "VARCHAR(50)"),
                    ("department", "VARCHAR(100)"),
                    ("batch", "VARCHAR(50)"),
                    ("rejection_reason", "VARCHAR(500)"),
                    ("verified_method", "VARCHAR(100)"),
                    ("verified_by", "INTEGER REFERENCES users(id)"),
                    ("verified_at", "DATETIME"),
                ]
                for col_name, col_type in new_cols:
                    if col_name not in cols:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                conn.execute(text("UPDATE users SET status = 'approved' WHERE status IS NULL"))
                conn.commit()
        else:
            new_cols = [
                ("status", "VARCHAR(20) DEFAULT 'approved'"),
                ("staff_id", "VARCHAR(50)"),
                ("department", "VARCHAR(100)"),
                ("batch", "VARCHAR(50)"),
                ("rejection_reason", "VARCHAR(500)"),
                ("verified_method", "VARCHAR(100)"),
                ("verified_by", "INTEGER REFERENCES users(id)"),
                ("verified_at", "DATETIME"),
            ]
            for col_name, col_type in new_cols:
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            conn.execute(text("UPDATE users SET status = 'approved' WHERE status IS NULL"))
            conn.commit()


"""Run via an OS scheduler if thumbnail expiry must continue while the API is stopped."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import settings
from app.database import SessionLocal
from app.services.privacy import cleanup


def main() -> None:
    settings.validate()
    with SessionLocal() as db:
        count = cleanup(db); db.commit()
    print(f"Expired/resolved review entries cleaned: {count}")


if __name__ == "__main__": main()

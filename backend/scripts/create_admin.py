"""Provision a secure initial administrator account without seeding demo data."""
import argparse
import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select
from app.config import settings
from app.database import Base, engine, SessionLocal, migrate_schema
from app.models import User
from app.security import hash_password


def create_admin(email: str, name: str, password: str) -> None:
    if len(password.encode()) < 10:
        raise SystemExit("Error: Administrator password must be at least 10 characters.")
    
    settings.validate()
    Base.metadata.create_all(engine)
    migrate_schema(engine)

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == email))
        if existing is not None:
            if existing.role == "admin":
                print(f"Administrator account already exists: {email}")
                return
            raise SystemExit(f"Error: Account with email '{email}' already exists with role '{existing.role}'.")
        
        admin_user = User(
            email=email,
            name=name,
            role="admin",
            password_hash=hash_password(password),
            status="approved"
        )
        db.add(admin_user)
        db.commit()
        print(f"Successfully created administrator account: {email} ({name})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an initial administrator account.")
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL", "admin@university.edu"),
                        help="Administrator email address")
    parser.add_argument("--name", default=os.getenv("ADMIN_NAME", "Administrator"),
                        help="Administrator display name")
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD", ""),
                        help="Administrator password (min 10 characters). Prompted if omitted.")
    args = parser.parse_args()

    password = args.password
    if not password:
        password = getpass.getpass("Enter administrator password (min 10 chars): ")

    create_admin(args.email.strip(), args.name.strip(), password)


if __name__ == "__main__":
    main()

"""Create secrets locally; never print secrets or overwrite an existing .env."""
from pathlib import Path
import secrets
from cryptography.fernet import Fernet


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    destination = root / ".env"
    content = (root / ".env.example").read_text()
    content = content.replace("JWT_SECRET=\n", f"JWT_SECRET={secrets.token_urlsafe(48)}\n")
    content = content.replace("FERNET_KEY=\n", f"FERNET_KEY={Fernet.generate_key().decode()}\n")
    content = content.replace("SEED_PASSWORD=\n", f"SEED_PASSWORD={secrets.token_urlsafe(18)}\n")
    with destination.open("x", encoding="utf-8") as stream:
        stream.write(content)
    destination.chmod(0o600)
    print("Created backend/.env. Read SEED_PASSWORD locally for demo login; keep this file private.")


if __name__ == "__main__":
    main()

import secrets
from datetime import timedelta, datetime, timezone
from functools import lru_cache
import bcrypt
import jwt
import numpy as np
from cryptography.fernet import Fernet
from fastapi import HTTPException
from .config import settings


def hash_password(password: str) -> str:
    raw = password.encode()
    if not 10 <= len(raw) <= 72:
        raise HTTPException(422, "Password must be 10..72 UTF-8 bytes")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, encoded: str) -> bool:
    raw = password.encode()
    return len(raw) <= 72 and bcrypt.checkpw(raw, encoded.encode())


def token(payload: dict, purpose: str, seconds: int) -> str:
    stamp = datetime.now(timezone.utc)
    return jwt.encode({**payload, "purpose": purpose, "iat": stamp,
                       "exp": stamp + timedelta(seconds=seconds),
                       "jti": secrets.token_hex(16)}, settings.jwt_secret, algorithm="HS256")


def decode_token(value: str, purpose: str) -> dict:
    try:
        data = jwt.decode(value, settings.jwt_secret, algorithms=["HS256"],
                          options={"require": ["exp", "iat", "purpose", "jti"]})
        if data["purpose"] != purpose:
            raise ValueError("Wrong token purpose")
        return data
    except (jwt.PyJWTError, ValueError) as exc:
        raise HTTPException(401, "Invalid or expired token") from exc


@lru_cache
def cipher() -> Fernet:
    return Fernet(settings.fernet_key.encode())


def encrypt_vector(vector: np.ndarray) -> bytes:
    arr = np.asarray(vector, dtype="<f4")
    if arr.shape != (512,) or not np.isfinite(arr).all():
        raise ValueError("Expected finite 512-dimensional embedding")
    return cipher().encrypt(arr.tobytes())


def decrypt_vector(value: bytes) -> np.ndarray:
    arr = np.frombuffer(cipher().decrypt(value), dtype="<f4").copy()
    if arr.shape != (512,):
        raise ValueError("Invalid encrypted embedding length")
    return arr

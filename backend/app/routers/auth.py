from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from ..deps import DB, Current, public_user
from ..models import User
from ..schemas import Login
from ..security import verify_password, token
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
_attempts: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def rate_limit(ip: str) -> None:
    stamp = monotonic()
    with _lock:
        for key in list(_attempts):
            while _attempts[key] and _attempts[key][0] < stamp - 60:
                _attempts[key].popleft()
            if not _attempts[key]:
                del _attempts[key]
        if len(_attempts[ip]) >= 10:
            raise HTTPException(429, "Too many attempts. Wait one minute.", headers={"Retry-After": "60"})
        _attempts[ip].append(stamp)


@router.post("/login")
def login(body: Login, request: Request, db: DB) -> dict:
    rate_limit(request.client.host if request.client else "local")
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    # A fixed valid bcrypt hash prevents a cheap user-enumeration timing path.
    dummy = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxWbH0C.gPzC5EHUjP0lHcR2G9K"
    valid = verify_password(body.password, user.password_hash if user else dummy)
    if user is None or not valid:
        raise HTTPException(401, "Invalid email or password")
    return {"access_token": token({"sub": str(user.id)}, "access", settings.jwt_minutes * 60),
            "token_type": "bearer", "user": public_user(user)}


@router.get("/me")
def me(user: Current) -> dict:
    return public_user(user)

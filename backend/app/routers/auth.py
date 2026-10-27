from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from ..deps import DB, Current, public_user
from ..models import User
from ..schemas import Login, StudentRegisterIn, TeacherRegisterIn
from ..security import verify_password, hash_password, token, auth_error
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
_attempts: dict[str, deque] = defaultdict(deque)
_reg_attempts: dict[str, deque] = defaultdict(deque)
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


def reg_rate_limit(ip: str) -> None:
    stamp = monotonic()
    with _lock:
        for key in list(_reg_attempts):
            while _reg_attempts[key] and _reg_attempts[key][0] < stamp - 600:
                _reg_attempts[key].popleft()
            if not _reg_attempts[key]:
                del _reg_attempts[key]
        if len(_reg_attempts[ip]) >= 10:
            raise HTTPException(429, "Too many registration attempts. Please wait 10 minutes.", headers={"Retry-After": "600"})
        _reg_attempts[ip].append(stamp)


@router.post("/login")
def login(body: Login, request: Request, db: DB) -> dict:
    rate_limit(request.client.host if request.client else "local")
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    # A fixed valid bcrypt hash prevents a cheap user-enumeration timing path.
    dummy = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxWbH0C.gPzC5EHUjP0lHcR2G9K"
    valid = verify_password(body.password, user.password_hash if user else dummy)
    if user is None or not valid:
        raise auth_error(401, "INVALID_CREDENTIALS", "Invalid email or password")
    if getattr(user, "status", "approved") == "suspended":
        raise auth_error(403, "ACCOUNT_SUSPENDED", "This account has been suspended by an administrator. Please contact administration.")
    if body.portal is not None and body.portal != user.role:
        portal_names = {"student": "Student Portal", "teacher": "Teacher Portal", "admin": "Admin Portal"}
        target_name = portal_names.get(body.portal, f"{body.portal} portal")
        raise auth_error(403, "WRONG_PORTAL", f"This account is not authorized for the {target_name}. Please sign in through your assigned portal.")
    return {
        "access_token": token({"sub": str(user.id)}, "access", settings.jwt_minutes * 60),
        "token_type": "bearer",
        "user": public_user(user),
    }


@router.post("/register/student", status_code=201)
def register_student(body: StudentRegisterIn, request: Request, db: DB) -> dict:
    reg_rate_limit(request.client.host if request.client else "local")
    norm_email = body.email.strip().lower()
    norm_code = body.student_code.strip()

    if db.scalar(select(User.id).where(User.email == norm_email)):
        raise HTTPException(409, "Email is already registered")
    if db.scalar(select(User.id).where(User.student_code == norm_code)):
        raise HTTPException(409, "Student ID is already registered")

    user = User(
        name=body.name.strip(),
        email=norm_email,
        password_hash=hash_password(body.password),
        role="student",
        status="pending",
        student_code=norm_code,
        department=body.department.strip(),
        batch=body.batch.strip() if body.batch else None,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Duplicate email or student ID prevents registration") from exc

    return {
        "registered": True,
        "message": "Student registration submitted successfully. Your application is pending administrator verification.",
        "user": public_user(user),
    }


@router.post("/register/teacher", status_code=201)
def register_teacher(body: TeacherRegisterIn, request: Request, db: DB) -> dict:
    reg_rate_limit(request.client.host if request.client else "local")
    norm_email = body.email.strip().lower()
    norm_staff = body.staff_id.strip()

    if db.scalar(select(User.id).where(User.email == norm_email)):
        raise HTTPException(409, "Email is already registered")
    if db.scalar(select(User.id).where(User.staff_id == norm_staff)):
        raise HTTPException(409, "Staff ID is already registered")

    user = User(
        name=body.name.strip(),
        email=norm_email,
        password_hash=hash_password(body.password),
        role="teacher",
        status="pending",
        staff_id=norm_staff,
        department=body.department.strip(),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Duplicate email or staff ID prevents registration") from exc

    return {
        "registered": True,
        "message": "Teacher registration submitted successfully. Your application is pending administrator verification.",
        "user": public_user(user),
    }


@router.get("/me")
def me(user: Current) -> dict:
    return public_user(user)

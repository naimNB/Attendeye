from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, Section, TeacherAssignment, ClassSession, Enrolment, now
from .security import decode_token, auth_error

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]


def current_user(db: DB, auth: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> User:
    if auth is None:
        raise auth_error(401, "AUTH_REQUIRED", "Login required")
    data = decode_token(auth.credentials, "access")
    try:
        user = db.get(User, int(data["sub"]))
    except (KeyError, ValueError, TypeError):
        user = None
    if user is None:
        raise auth_error(401, "ACCOUNT_UNAVAILABLE", "Account unavailable")
    if getattr(user, "status", "approved") == "suspended":
        raise auth_error(401, "ACCOUNT_UNAVAILABLE", "Account has been suspended")
    return user


Current = Annotated[User, Depends(current_user)]


def roles(*allowed: str):
    def guard(user: Current) -> User:
        user_status = getattr(user, "status", "approved")
        if user_status != "approved":
            raise HTTPException(403, f"Account is {user_status}. Access to protected features is restricted.")
        if user.role not in allowed:
            raise HTTPException(403, "Role not permitted")
        return user
    return guard


Admin = Annotated[User, Depends(roles("admin"))]
Teacher = Annotated[User, Depends(roles("teacher", "admin"))]
Student = Annotated[User, Depends(roles("student"))]


def section_access(db: Session, user: User, section_id: int) -> Section:
    section = db.get(Section, section_id)
    if section is None:
        raise HTTPException(404, "Section not found")
    permitted = user.role == "admin"
    if user.role == "teacher":
        permitted = db.get(TeacherAssignment, (user.id, section_id)) is not None
    elif user.role == "student":
        permitted = db.get(Enrolment, (user.id, section_id)) is not None
    if not permitted:
        raise HTTPException(403, "Section access denied")
    return section


def session_access(db: Session, user: User, session_id: int, capture: bool = False) -> ClassSession:
    item = db.get(ClassSession, session_id)
    if item is None:
        raise HTTPException(404, "Session not found")
    section_access(db, user, item.section_id)
    if capture and (item.status != "open" or not item.starts_at <= now() <= item.ends_at):
        raise HTTPException(409, "Capture allowed only in an open session's time window")
    return item


def public_user(user: User) -> dict:
    created_iso = user.created_at.isoformat() if hasattr(user, "created_at") and user.created_at else None
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "status": getattr(user, "status", "approved"),
        "student_code": getattr(user, "student_code", None),
        "staff_id": getattr(user, "staff_id", None),
        "department": getattr(user, "department", None),
        "batch": getattr(user, "batch", None),
        "rejection_reason": getattr(user, "rejection_reason", None),
        "verified_method": getattr(user, "verified_method", None),
        "created_at": created_iso,
    }

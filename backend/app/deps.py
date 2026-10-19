from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, Section, TeacherAssignment, ClassSession, Enrolment, now
from .security import decode_token

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]


def current_user(db: DB, auth: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> User:
    if auth is None:
        raise HTTPException(401, "Login required")
    data = decode_token(auth.credentials, "access")
    try:
        user = db.get(User, int(data["sub"]))
    except (KeyError, ValueError, TypeError):
        user = None
    if user is None:
        raise HTTPException(401, "Account unavailable")
    return user


Current = Annotated[User, Depends(current_user)]


def roles(*allowed: str):
    def guard(user: Current) -> User:
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
    return {key: getattr(user, key) for key in ("id", "name", "email", "role", "student_code")}

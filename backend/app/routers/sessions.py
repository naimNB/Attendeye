from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from sqlalchemy import select
from ..deps import DB, Teacher, session_access, section_access
from ..models import ClassSession, Enrolment, TeacherAssignment, User, Section, Course, now
from ..schemas import SessionIn
from ..services.uploads import read_image
from ..services.recognition import capture
from ..services.attendance import set_record, notify_section
from ..services.locks import mutation_lock, processing_slots
from ..services.challenges import consume
from ..config import settings

router = APIRouter(prefix="/sessions", tags=["sessions"])


def session_dict(row: ClassSession, db: DB | None = None) -> dict:
    room = getattr(row, "room", None)
    if room is None and db is not None:
        sec = db.get(Section, row.section_id)
        room = getattr(sec, "room", None) if sec else None
    return {
        "id": row.id,
        "section_id": row.section_id,
        "teacher_id": row.teacher_id,
        "room": room,
        "starts_at": row.starts_at.isoformat() + "Z",
        "ends_at": row.ends_at.isoformat() + "Z",
        "status": row.status,
        "require_qr": row.require_qr,
        "is_demo": row.is_demo,
    }


@router.post("", status_code=201)
def create(body: SessionIn, db: DB, teacher: Teacher) -> dict:
    with mutation_lock:
        sec = section_access(db, teacher, body.section_id)
        if body.ends_at <= now(): raise HTTPException(422, "End time must be in the future")
        if not db.scalar(select(Enrolment.student_id).where(Enrolment.section_id == body.section_id).limit(1)):
            raise HTTPException(409, "Add the class roster before creating a session")
        session_room = body.room if body.room is not None else getattr(sec, "room", None)
        data = body.model_dump()
        data["room"] = session_room
        row = ClassSession(**data, teacher_id=teacher.id)
        db.add(row); db.commit()
    return session_dict(row, db)


@router.get("")
def listing(db: DB, teacher: Teacher) -> list:
    query = select(ClassSession)
    if teacher.role == "teacher":
        query = query.where(ClassSession.section_id.in_(select(TeacherAssignment.section_id).where(TeacherAssignment.teacher_id == teacher.id)))
    return [session_dict(row, db) for row in db.scalars(query.order_by(ClassSession.starts_at.desc()))]


@router.get("/{session_id}")
def detail(session_id: int, db: DB, teacher: Teacher) -> dict:
    return {**session_dict(session_access(db, teacher, session_id), db), "debug_available": settings.debug and teacher.role == "teacher"}


@router.get("/{session_id}/roster")
def roster(session_id: int, db: DB, teacher: Teacher) -> list:
    row = session_access(db, teacher, session_id)
    return [{"id": u.id, "name": u.name, "student_code": u.student_code} for u in db.scalars(
        select(User).join(Enrolment, Enrolment.student_id == User.id).where(Enrolment.section_id == row.section_id))]


def do_capture(session_id: int, db: DB, teacher: Teacher, images: list[UploadFile],
               volunteers_confirmed: bool, signed: str | None, debug: bool) -> dict:
    if not volunteers_confirmed:
        raise HTTPException(422, "Confirm that everyone pictured consented to this capture")
    if not processing_slots.acquire(blocking=False):
        raise HTTPException(429, "Recognition is busy. Retry shortly.")
    try:
        with mutation_lock:
            row = session_access(db, teacher, session_id, capture=True)
            if debug and (not settings.debug or teacher.role != "teacher"):
                raise HTTPException(403, "Teacher debug view is disabled")
            prompt = consume(db, signed, teacher.id, session_id) if signed else None
        blobs = [read_image(file) for file in images]
        try:
            return capture(db, row, blobs, prompt, debug)
        except ValueError as err:
            raise HTTPException(409, str(err))
    finally:
        processing_slots.release()


@router.post("/{session_id}/capture-photo")
def photo(session_id: int, db: DB, teacher: Teacher, image: UploadFile = File(...),
          volunteers_confirmed: bool = Form(False), debug: bool = Form(False)) -> dict:
    return do_capture(session_id, db, teacher, [image], volunteers_confirmed, None, debug)


@router.post("/{session_id}/capture-frames")
def frames(session_id: int, db: DB, teacher: Teacher, frames: list[UploadFile] = File(...),
           challenge_token: str = Form(...), volunteers_confirmed: bool = Form(False), debug: bool = Form(False)) -> dict:
    if not 5 <= len(frames) <= 8:
        raise HTTPException(422, "Supply 5..8 distinct frames")
    return do_capture(session_id, db, teacher, frames, volunteers_confirmed, challenge_token, debug)


@router.post("/{session_id}/close")
def close(session_id: int, db: DB, teacher: Teacher) -> dict:
    with mutation_lock:
        row = session_access(db, teacher, session_id)
        if row.status == "closed": return session_dict(row)
        for sid in db.scalars(select(Enrolment.student_id).where(Enrolment.section_id == row.section_id)):
            set_record(db, row.id, sid, status="absent")
        row.status, row.closed_at = "closed", now()
        db.flush(); notify_section(db, row.section_id); db.commit()
    return session_dict(row)

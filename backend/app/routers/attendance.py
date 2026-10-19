import json
from datetime import timedelta
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from ..deps import DB, Student, Teacher, Current, session_access
from ..models import AttendanceRecord, ReviewItem, Enrolment, Section, Course, User, Notification, AuditLog, QRRedemption, now
from ..schemas import Correction, Resolution
from ..config import settings
from ..security import cipher
from ..services.attendance import section_percentage, set_record, notify_section, get_settings
from ..services.privacy import remove_thumbnail, cleanup
from ..services.locks import mutation_lock

router = APIRouter(tags=["attendance", "review"])


def record_dict(row: AttendanceRecord, db: DB) -> dict:
    return {"id": row.id, "student_id": row.student_id, "name": db.get(User, row.student_id).name,
            "status": row.status, "confidence": row.confidence, "source": row.source,
            "updated_at": row.updated_at.isoformat() + "Z"}


@router.get("/attendance/me")
def my_attendance(db: DB, student: Student) -> list:
    limit = get_settings(db)["attendance_limit"]
    result = []
    for section in db.scalars(select(Section).join(Enrolment).where(Enrolment.student_id == student.id)):
        stats = section_percentage(db, student.id, section.id)
        result.append({"section_id": section.id, "section": section.name,
                       "course": db.get(Course, section.course_id).code, **stats,
                       "limit": limit, "below_limit": stats["percentage"] is not None and stats["percentage"] < limit})
    return result


@router.get("/sessions/{session_id}/records")
def records(session_id: int, db: DB, teacher: Teacher) -> list:
    session_access(db, teacher, session_id)
    return [record_dict(r, db) for r in db.scalars(select(AttendanceRecord).where(AttendanceRecord.session_id == session_id))]


@router.put("/attendance/{record_id}")
def correct(record_id: int, body: Correction, db: DB, teacher: Teacher) -> dict:
    with mutation_lock:
        record = db.get(AttendanceRecord, record_id)
        if record is None: raise HTTPException(404, "Record not found")
        row = session_access(db, teacher, record.session_id)
        if row.require_qr and body.status == "present" and db.get(QRRedemption, (row.id, record.student_id)) is None:
            raise HTTPException(409, "QR-required session needs a successful two-factor check-in")
        updated = set_record(db, row.id, record.student_id, body.status, source="manual", actor_id=teacher.id, reason=body.reason)
        notify_section(db, row.section_id); db.commit()
    return record_dict(updated, db)


@router.get("/sessions/{session_id}/audit")
def audit(session_id: int, db: DB, teacher: Teacher) -> list:
    session_access(db, teacher, session_id)
    return [{"id": a.id, "record_id": a.record_id, "actor_id": a.actor_id,
             "old_status": a.old_status, "new_status": a.new_status, "reason": a.reason,
             "created_at": a.created_at.isoformat() + "Z"} for a in db.scalars(
                 select(AuditLog).join(AttendanceRecord).where(AttendanceRecord.session_id == session_id))]


@router.get("/sessions/{session_id}/review")
def review(session_id: int, db: DB, teacher: Teacher) -> list:
    session_access(db, teacher, session_id)
    with mutation_lock:
        cleanup(db); db.commit()
        return [{"id": r.id, "reason": r.reason, "status": r.status,
                 "has_thumbnail": r.thumbnail_path is not None,
                 "candidates": json.loads(r.candidates_json)} for r in db.scalars(
                     select(ReviewItem).where(ReviewItem.session_id == session_id).order_by(ReviewItem.id.desc()))]


@router.get("/review/{item_id}/thumbnail")
def thumbnail(item_id: int, db: DB, teacher: Teacher) -> Response:
    with mutation_lock:
        row = db.get(ReviewItem, item_id)
        if row is None: raise HTTPException(404, "Review item not found")
        session_access(db, teacher, row.session_id)
        if row.created_at <= now() - timedelta(hours=24) or row.status == "resolved":
            remove_thumbnail(row); db.commit()
        if not row.thumbnail_path: raise HTTPException(404, "Thumbnail expired")
        path = settings.private_dir / Path(row.thumbnail_path).name
        if not path.is_file(): raise HTTPException(404, "Thumbnail unavailable")
        return Response(cipher().decrypt(path.read_bytes()), media_type="image/jpeg",
                        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


@router.post("/review/{item_id}/resolve")
def resolve(item_id: int, body: Resolution, db: DB, teacher: Teacher) -> dict:
    with mutation_lock:
        item = db.get(ReviewItem, item_id)
        if item is None: raise HTTPException(404, "Review item not found")
        row = session_access(db, teacher, item.session_id)
        if item.status != "pending": raise HTTPException(409, "Already resolved")
        if body.student_id is not None:
            if not db.get(Enrolment, (body.student_id, row.section_id)):
                raise HTTPException(422, "Student is not on this class roster")
            if row.require_qr and not db.get(QRRedemption, (row.id, body.student_id)):
                raise HTTPException(409, "Two-factor check-in required for this session")
            set_record(db, row.id, body.student_id, source="manual", actor_id=teacher.id, reason=body.reason)
        item.status, item.resolved_by, item.resolved_at = "resolved", teacher.id, now()
        # Resolution reason is retained even when no attendance record is created (rejection).
        item.reason = (item.reason + " | " + body.reason)[:200]
        remove_thumbnail(item); db.flush(); notify_section(db, row.section_id); db.commit()
    return {"resolved": True}


@router.get("/notifications")
def notifications(db: DB, user: Current) -> list:
    return [{"id": n.id, "message": n.message, "read": n.read, "created_at": n.created_at.isoformat() + "Z"}
            for n in db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(100))]


@router.post("/notifications/{notification_id}/read")
def read_notification(notification_id: int, db: DB, user: Current) -> dict:
    row = db.get(Notification, notification_id)
    if row is None or row.user_id != user.id: raise HTTPException(404, "Notification not found")
    row.read = True; db.commit()
    return {"read": True}

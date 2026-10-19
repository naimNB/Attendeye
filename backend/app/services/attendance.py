from sqlalchemy import select, func
from sqlalchemy.orm import Session
from ..models import AttendanceRecord, ClassSession, Enrolment, Notification, Setting, Section, Course, AuditLog, now


def get_settings(db: Session) -> dict[str, float]:
    result = {"attendance_limit": 75., "t_low": .35, "t_high": .50, "margin": .05}
    for item in db.scalars(select(Setting)):
        if item.key in result:
            result[item.key] = float(item.value)
    return result


def percentage(present: int, closed: int) -> float | None:
    return round(present * 100 / closed, 2) if closed else None


def section_percentage(db: Session, student_id: int, section_id: int) -> dict:
    sessions = list(db.scalars(select(ClassSession.id).where(ClassSession.section_id == section_id, ClassSession.status == "closed")))
    present = db.scalar(select(func.count()).select_from(AttendanceRecord).where(
        AttendanceRecord.session_id.in_(sessions), AttendanceRecord.student_id == student_id,
        AttendanceRecord.status == "present")) or 0
    return {"closed_sessions": len(sessions), "present": present, "percentage": percentage(present, len(sessions))}


def notify_section(db: Session, section_id: int) -> None:
    limit = get_settings(db)["attendance_limit"]
    section = db.get(Section, section_id)
    course = db.get(Course, section.course_id)
    for student_id in db.scalars(select(Enrolment.student_id).where(Enrolment.section_id == section_id)):
        stats = section_percentage(db, student_id, section_id)
        if stats["percentage"] is not None and stats["percentage"] < limit:
            message = f"Attendance alert: {course.code} / {section.name}: {stats['percentage']}%, below {limit}%."
            exists = db.scalar(select(Notification.id).where(Notification.user_id == student_id,
                               Notification.message == message, Notification.read.is_(False)))
            if not exists:
                db.add(Notification(user_id=student_id, message=message))


def set_record(db: Session, session_id: int, student_id: int, status: str = "present",
               confidence: float | None = None, source: str = "auto",
               actor_id: int | None = None, reason: str | None = None) -> AttendanceRecord:
    record = db.scalar(select(AttendanceRecord).where(AttendanceRecord.session_id == session_id,
                                                   AttendanceRecord.student_id == student_id))
    if source == "auto" and record is not None:
        # Repeated recognition must never overwrite a teacher's correction.
        return record
    old = record.status if record else None
    if record is None:
        record = AttendanceRecord(session_id=session_id, student_id=student_id,
                                  status=status, confidence=confidence, source=source)
        db.add(record)
    else:
        record.status, record.confidence, record.source = status, confidence, source
        record.updated_at = now()
    db.flush()
    if source == "manual":
        if actor_id is None or not reason or len(reason.strip()) < 3:
            raise ValueError("Manual changes require actor and reason")
        db.add(AuditLog(actor_id=actor_id, record_id=record.id, old_status=old,
                        new_status=status, reason=reason.strip()))
    return record

from fastapi import APIRouter
from sqlalchemy import select
from ..deps import DB, Teacher, section_access, session_access
from ..models import AttendanceRecord, User, Enrolment, Section, Course
from ..services.attendance import section_percentage
from ..services.reports import export

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/course/{section_id}")
def course_report(section_id: int, db: DB, teacher: Teacher, format: str = "csv"):
    section = section_access(db, teacher, section_id)
    course = db.get(Course, section.course_id)
    rows = []
    for user in db.scalars(select(User).join(Enrolment, Enrolment.student_id == User.id).where(Enrolment.section_id == section_id)):
        rows.append({"Student": user.name, "Code": user.student_code or "", **section_percentage(db, user.id, section_id)})
    return export(rows, format, f"section-{section_id}", f"{course.code} / {section.name} Attendance")


@router.get("/date/{session_id}")
def date_report(session_id: int, db: DB, teacher: Teacher, format: str = "csv"):
    session = session_access(db, teacher, session_id)
    rows = [{"Student": db.get(User, r.student_id).name, "Status": r.status, "Source": r.source,
             "Confidence": r.confidence if r.confidence is not None else "", "DEMO": session.is_demo}
            for r in db.scalars(select(AttendanceRecord).where(AttendanceRecord.session_id == session_id))]
    return export(rows, format, f"session-{session_id}", f"{'DEMO — ' if session.is_demo else ''}Session {session_id}")

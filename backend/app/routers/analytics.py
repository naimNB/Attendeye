from collections import Counter, defaultdict
from fastapi import APIRouter
from sqlalchemy import select
from ..deps import DB, Teacher, section_access
from ..models import ClassSession, AttendanceRecord, TeacherAssignment, Section, Course, Enrolment, User, ReviewItem, AuditLog
from ..services.attendance import get_settings, percentage
from ..services.reports import export

router = APIRouter(prefix="/analytics", tags=["analytics"])


def build(db: DB, teacher: Teacher, section_id: int | None, include_demo: bool) -> dict:
    query = select(Section)
    if teacher.role != "admin":
        query = query.where(Section.id.in_(select(TeacherAssignment.section_id).where(TeacherAssignment.teacher_id == teacher.id)))
    if section_id is not None:
        section_access(db, teacher, section_id)
        query = query.where(Section.id == section_id)
    sections = list(db.scalars(query))
    daily, sessions_data, risk = [], [], []
    weekday = defaultdict(lambda: [0, 0])
    counts = Counter({"auto": 0, "manual": 0, "unknown": 0, "pending": 0, "resolved": 0})
    reasons = Counter()
    limit = get_settings(db)["attendance_limit"]
    for section in sections:
        label = f"{db.get(Course, section.course_id).code} / {section.name}"
        sq = select(ClassSession).where(ClassSession.section_id == section.id, ClassSession.status == "closed")
        if not include_demo: sq = sq.where(ClassSession.is_demo.is_(False))
        sessions = list(db.scalars(sq.order_by(ClassSession.starts_at)))
        ids = [s.id for s in sessions]
        records = list(db.scalars(select(AttendanceRecord).where(AttendanceRecord.session_id.in_(ids))))
        record_map = {(r.session_id, r.student_id): r for r in records}
        roster = list(db.scalars(select(User).join(Enrolment, Enrolment.student_id == User.id).where(Enrolment.section_id == section.id)))
        cumulative = 0
        for i, session in enumerate(sessions):
            present = sum(record_map.get((session.id, u.id)) is not None and record_map[(session.id, u.id)].status == "present" for u in roster)
            cumulative += present
            rate = percentage(present, len(roster))
            sessions_data.append({"session": session.id, "date": session.starts_at.date().isoformat(),
                                  "section": label, "rate": rate, "demo": session.is_demo})
            daily.append({"date": session.starts_at.date().isoformat(), "section": label,
                          "percentage": percentage(cumulative, len(roster) * (i + 1))})
            values = weekday[session.starts_at.weekday()]
            values[0] += present; values[1] += len(roster)
        for user in roster:
            history = [int((s.id, user.id) in record_map and record_map[(s.id, user.id)].status == "present") for s in sessions]
            current = percentage(sum(history), len(history))
            recent = percentage(sum(history[-5:]), len(history[-5:]))
            previous = percentage(sum(history[-10:-5]), len(history[-10:-5]))
            down = previous is not None and recent is not None and recent < previous
            if current is not None and (current < limit or down):
                risk.append({"student_id": user.id, "name": user.name, "section": label, "percentage": current,
                             "recent_5": recent, "previous_5": previous, "trending_down": down})
        for record in records:
            if record.status == "present": counts[record.source] += 1
        # Queue counts include open sessions too, filtered consistently for DEMO.
        all_sessions = select(ClassSession.id).where(ClassSession.section_id == section.id)
        if not include_demo: all_sessions = all_sessions.where(ClassSession.is_demo.is_(False))
        for item in db.scalars(select(ReviewItem).where(ReviewItem.session_id.in_(all_sessions))):
            counts[item.status] += 1
            if item.reason.startswith("unknown"): counts["unknown"] += 1
        for audit in db.scalars(select(AuditLog).join(AttendanceRecord).where(AttendanceRecord.session_id.in_(all_sessions))):
            reasons[audit.reason] += 1
    return {"over_time": daily, "sessions": sessions_data, "weekday": [
        {"day": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], "rate": percentage(weekday[i][0], weekday[i][1])}
        for i in range(7)], "at_risk": risk, "review": [{"name": k, "count": v} for k, v in counts.items()],
        "corrections": [{"reason": k, "count": v} for k, v in reasons.items()], "includes_demo": include_demo,
        "definitions": "Auto/manual count present records; unknown counts review items and can overlap resolved/pending. Trends compare the latest five sessions with the preceding five (partial windows allowed)."}


@router.get("")
def analytics(db: DB, teacher: Teacher, section_id: int | None = None, include_demo: bool = False) -> dict:
    return build(db, teacher, section_id, include_demo)


@router.get("/at-risk.csv")
def risk_csv(db: DB, teacher: Teacher, section_id: int | None = None, include_demo: bool = False):
    return export(build(db, teacher, section_id, include_demo)["at_risk"], "csv", "at-risk", "At-risk students")

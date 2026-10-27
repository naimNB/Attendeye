from fastapi import APIRouter, HTTPException
from sqlalchemy import select, delete, func
from sqlalchemy.exc import IntegrityError
from ..deps import DB, Admin, Current, public_user, section_access
from ..models import User, Course, Section, Enrolment, TeacherAssignment, Setting, ClassSession, ApplicationAudit, now
from ..schemas import UserIn, CourseIn, SectionIn, EnrolmentIn, AssignmentIn, SettingsIn, ApprovalIn, RejectionIn, SuspensionIn
from ..security import hash_password
from ..services.attendance import get_settings, notify_section
from ..services.privacy import revoke_biometrics
from ..services.locks import mutation_lock

router = APIRouter(tags=["administration"])


def commit(db: DB) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Duplicate value or related records prevent this change") from exc


def require_row(db: DB, model: type, key: object):
    row = db.get(model, key)
    if row is None:
        raise HTTPException(404, "Record not found")
    return row


def validate_link(db: DB, body: object, role: str) -> None:
    uid = body.student_id if role == "student" else body.teacher_id
    person = require_row(db, User, uid)
    require_row(db, Section, body.section_id)
    if person.role != role:
        raise HTTPException(422, f"User must be a {role}")


def roster_unlocked(db: DB, section_id: int) -> None:
    if db.scalar(select(ClassSession.id).where(ClassSession.section_id == section_id).limit(1)):
        raise HTTPException(409, "Roster is frozen after the first session. Create a new section for roster changes.")


@router.get("/users")
def users(db: DB, admin: Admin) -> list:
    return [public_user(u) for u in db.scalars(select(User).order_by(User.id))]


@router.post("/users", status_code=201)
def create_user(body: UserIn, db: DB, admin: Admin) -> dict:
    if body.password is None:
        raise HTTPException(422, "Password required")
    data = body.model_dump(exclude={"password"})
    if not data.get("status"):
        data["status"] = "approved"
    user = User(**data, password_hash=hash_password(body.password))
    db.add(user)
    commit(db)
    return public_user(user)


@router.put("/users/{user_id}")
def update_user(user_id: int, body: UserIn, db: DB, admin: Admin) -> dict:
    user = require_row(db, User, user_id)
    if body.role != user.role:
        raise HTTPException(409, "Role changes require a new account to preserve historical authorization")
    for key, value in body.model_dump(exclude={"password"}).items():
        setattr(user, key, value)
    if body.password:
        user.password_hash = hash_password(body.password)
    commit(db)
    return public_user(user)


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: DB, admin: Admin) -> dict:
    if user_id == admin.id:
        raise HTTPException(409, "Cannot delete your own admin account")
    with mutation_lock:
        user = require_row(db, User, user_id)
        # Historical users cannot be deleted; database foreign keys preserve audit integrity.
        db.delete(user)
        commit(db)
    return {"deleted": True}


@router.get("/courses")
def courses(db: DB, user: Current) -> list:
    return [{"id": c.id, "code": c.code, "title": c.title} for c in db.scalars(select(Course))]


@router.post("/courses", status_code=201)
def create_course(body: CourseIn, db: DB, admin: Admin) -> dict:
    row = Course(**body.model_dump()); db.add(row); commit(db)
    return {"id": row.id, **body.model_dump()}


@router.put("/courses/{key}")
def update_course(key: int, body: CourseIn, db: DB, admin: Admin) -> dict:
    row = require_row(db, Course, key)
    for field, value in body.model_dump().items(): setattr(row, field, value)
    commit(db)
    return {"id": key, **body.model_dump()}


@router.delete("/courses/{key}")
def delete_course(key: int, db: DB, admin: Admin) -> dict:
    db.delete(require_row(db, Course, key)); commit(db)
    return {"deleted": True}


@router.get("/sections")
def sections(db: DB, user: Current) -> list:
    query = select(Section)
    if user.role == "student":
        query = query.join(Enrolment, Enrolment.section_id == Section.id).where(Enrolment.student_id == user.id)
    elif user.role == "teacher":
        query = query.join(TeacherAssignment, TeacherAssignment.section_id == Section.id).where(TeacherAssignment.teacher_id == user.id)
    return [{"id": row.id, "course_id": row.course_id, "name": row.name,
             "course_code": db.get(Course, row.course_id).code} for row in db.scalars(query)]


@router.post("/sections", status_code=201)
def create_section(body: SectionIn, db: DB, admin: Admin) -> dict:
    require_row(db, Course, body.course_id)
    row = Section(**body.model_dump()); db.add(row); commit(db)
    return {"id": row.id, **body.model_dump()}


@router.put("/sections/{key}")
def update_section(key: int, body: SectionIn, db: DB, admin: Admin) -> dict:
    row = require_row(db, Section, key)
    require_row(db, Course, body.course_id)
    if row.course_id != body.course_id: roster_unlocked(db, key)
    row.course_id, row.name = body.course_id, body.name
    commit(db)
    return {"id": key, **body.model_dump()}


@router.delete("/sections/{key}")
def delete_section(key: int, db: DB, admin: Admin) -> dict:
    db.delete(require_row(db, Section, key)); commit(db)
    return {"deleted": True}


@router.get("/enrolments")
def enrolments(db: DB, admin: Admin) -> list:
    return [{"student_id": r.student_id, "section_id": r.section_id} for r in db.scalars(select(Enrolment))]


@router.post("/enrolments", status_code=201)
def create_enrolment(body: EnrolmentIn, db: DB, admin: Admin) -> dict:
    with mutation_lock:
        validate_link(db, body, "student"); roster_unlocked(db, body.section_id)
        db.add(Enrolment(**body.model_dump())); commit(db)
    return body.model_dump()


@router.put("/enrolments/{student_id}/{section_id}")
def update_enrolment(student_id: int, section_id: int, body: EnrolmentIn, db: DB, admin: Admin) -> dict:
    with mutation_lock:
        roster_unlocked(db, section_id); roster_unlocked(db, body.section_id)
        validate_link(db, body, "student")
        db.delete(require_row(db, Enrolment, (student_id, section_id))); db.flush()
        db.add(Enrolment(**body.model_dump())); commit(db)
    return body.model_dump()


@router.delete("/enrolments/{student_id}/{section_id}")
def delete_enrolment(student_id: int, section_id: int, db: DB, admin: Admin) -> dict:
    with mutation_lock:
        roster_unlocked(db, section_id)
        db.delete(require_row(db, Enrolment, (student_id, section_id))); commit(db)
    return {"deleted": True}


@router.get("/teacher-assignments")
def assignments(db: DB, admin: Admin) -> list:
    return [{"teacher_id": r.teacher_id, "section_id": r.section_id} for r in db.scalars(select(TeacherAssignment))]


@router.post("/teacher-assignments", status_code=201)
def create_assignment(body: AssignmentIn, db: DB, admin: Admin) -> dict:
    validate_link(db, body, "teacher")
    db.add(TeacherAssignment(**body.model_dump())); commit(db)
    return body.model_dump()


@router.put("/teacher-assignments/{teacher_id}/{section_id}")
def update_assignment(teacher_id: int, section_id: int, body: AssignmentIn, db: DB, admin: Admin) -> dict:
    validate_link(db, body, "teacher")
    db.delete(require_row(db, TeacherAssignment, (teacher_id, section_id))); db.flush()
    db.add(TeacherAssignment(**body.model_dump())); commit(db)
    return body.model_dump()


@router.delete("/teacher-assignments/{teacher_id}/{section_id}")
def delete_assignment(teacher_id: int, section_id: int, db: DB, admin: Admin) -> dict:
    db.delete(require_row(db, TeacherAssignment, (teacher_id, section_id))); commit(db)
    return {"deleted": True}


@router.get("/settings")
def read_settings(db: DB, user: Current) -> dict:
    return get_settings(db)


@router.put("/settings")
def write_settings(body: SettingsIn, db: DB, admin: Admin) -> dict:
    with mutation_lock:
        for key, value in body.model_dump().items():
            db.merge(Setting(key=key, value=str(value)))
        db.flush()
        for section_id in db.scalars(select(Section.id)):
            notify_section(db, section_id)
        commit(db)
    return get_settings(db)


@router.get("/registration-requests")
@router.get("/admin/registration-requests")
def list_registration_requests(db: DB, admin: Admin, status: str | None = None) -> list:
    query = select(User)
    if status:
        query = query.where(User.status == status)
    else:
        query = query.where(User.status.in_(["pending", "rejected", "suspended"]))
    users = db.scalars(query.order_by(User.id.desc())).all()
    return [public_user(u) for u in users]


@router.post("/registration-requests/{user_id}/approve")
@router.post("/admin/registration-requests/{user_id}/approve")
def approve_registration(user_id: int, body: ApprovalIn, db: DB, admin: Admin) -> dict:
    user = require_row(db, User, user_id)
    if user.status not in ("pending", "rejected"):
        raise HTTPException(409, f"User is currently {user.status}; only pending or rejected applications can be approved")
    user.status = "approved"
    user.verified_method = body.verification_method
    user.verified_by = admin.id
    user.verified_at = now()
    user.rejection_reason = None
    audit = ApplicationAudit(
        user_id=user.id,
        actor_id=admin.id,
        action="approved",
        verification_method=body.verification_method,
        reason=f"Approved via {body.verification_method.replace('_', ' ')}",
    )
    db.add(audit)
    commit(db)
    return {"approved": True, "user": public_user(user)}


@router.post("/registration-requests/{user_id}/reject")
@router.post("/admin/registration-requests/{user_id}/reject")
def reject_registration(user_id: int, body: RejectionIn, db: DB, admin: Admin) -> dict:
    user = require_row(db, User, user_id)
    if user.id == admin.id:
        raise HTTPException(409, "Cannot reject your own admin account")
    user.status = "rejected"
    user.rejection_reason = body.reason.strip()
    audit = ApplicationAudit(
        user_id=user.id,
        actor_id=admin.id,
        action="rejected",
        reason=body.reason.strip(),
    )
    db.add(audit)
    commit(db)
    return {"rejected": True, "user": public_user(user)}


@router.post("/users/{user_id}/suspend")
@router.post("/admin/users/{user_id}/suspend")
def suspend_user(user_id: int, body: SuspensionIn, db: DB, admin: Admin) -> dict:
    user = require_row(db, User, user_id)
    if user.id == admin.id:
        raise HTTPException(409, "Cannot suspend your own admin account")
    user.status = "suspended"
    user.rejection_reason = body.reason.strip()
    audit = ApplicationAudit(
        user_id=user.id,
        actor_id=admin.id,
        action="suspended",
        reason=body.reason.strip(),
    )
    db.add(audit)
    commit(db)
    return {"suspended": True, "user": public_user(user)}


@router.post("/users/{user_id}/unsuspend")
@router.post("/admin/users/{user_id}/unsuspend")
def unsuspend_user(user_id: int, db: DB, admin: Admin) -> dict:
    user = require_row(db, User, user_id)
    if user.status != "suspended":
        raise HTTPException(409, f"User is not suspended (current status: {user.status})")
    user.status = "approved"
    user.rejection_reason = None
    audit = ApplicationAudit(
        user_id=user.id,
        actor_id=admin.id,
        action="reactivated",
        reason="Suspension lifted by administrator",
    )
    db.add(audit)
    commit(db)
    return {"reactivated": True, "user": public_user(user)}


@router.get("/application-history")
@router.get("/admin/application-history")
def list_application_history(db: DB, admin: Admin) -> list:
    audits = db.scalars(select(ApplicationAudit).order_by(ApplicationAudit.created_at.desc())).all()
    out = []
    for a in audits:
        candidate = db.get(User, a.user_id)
        actor = db.get(User, a.actor_id)
        out.append({
            "id": a.id,
            "user_id": a.user_id,
            "candidate_name": candidate.name if candidate else f"User #{a.user_id}",
            "candidate_email": candidate.email if candidate else "unknown",
            "candidate_role": candidate.role if candidate else "unknown",
            "actor_id": a.actor_id,
            "actor_name": actor.name if actor else f"Admin #{a.actor_id}",
            "action": a.action,
            "verification_method": a.verification_method,
            "reason": a.reason,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return out

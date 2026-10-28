from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, Boolean, DateTime, LargeBinary, ForeignKey, UniqueConstraint, CheckConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


def now() -> datetime:
    """UTC, stored without tzinfo for portable SQLite/PostgreSQL comparisons."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    student_code: Mapped[str | None] = mapped_column(String(50), unique=True)
    staff_id: Mapped[str | None] = mapped_column(String(50), unique=True)
    department: Mapped[str | None] = mapped_column(String(100))
    batch: Mapped[str | None] = mapped_column(String(50))
    rejection_reason: Mapped[str | None] = mapped_column(String(500))
    verified_method: Mapped[str | None] = mapped_column(String(100))
    verified_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(default=now)
    __table_args__ = (
        CheckConstraint("role IN ('student','teacher','admin')"),
        CheckConstraint("status IN ('pending','approved','rejected','suspended')"),
    )


class ApplicationAudit(Base):
    __tablename__ = "application_audit"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(20))
    verification_method: Mapped[str | None] = mapped_column(String(100))
    reason: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(default=now)
    __table_args__ = (CheckConstraint("action IN ('approved','rejected','suspended','reactivated')"),)


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    title: Mapped[str] = mapped_column(String(150))


class Section(Base):
    __tablename__ = "sections"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    name: Mapped[str] = mapped_column(String(80))
    room: Mapped[str | None] = mapped_column(String(80), nullable=True)
    __table_args__ = (UniqueConstraint("course_id", "name"),)


class TeacherAssignment(Base):
    __tablename__ = "teacher_assignments"
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"), primary_key=True)


class Enrolment(Base):
    __tablename__ = "enrolments"
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"), primary_key=True)


class Consent(Base):
    __tablename__ = "consents"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    text_version: Mapped[str] = mapped_column(String(30))
    granted_at: Mapped[datetime] = mapped_column(default=now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    vector_encrypted: Mapped[bytes] = mapped_column(LargeBinary)
    pose_label: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(default=now)


class ClassSession(Base):
    __tablename__ = "class_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    room: Mapped[str | None] = mapped_column(String(80), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(10), default="open")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)
    require_qr: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (CheckConstraint("status IN ('open','closed')"),)


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("class_sessions.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(10))
    confidence: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(10))
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)
    __table_args__ = (UniqueConstraint("session_id", "student_id"),
                     CheckConstraint("status IN ('present','absent')"),
                     CheckConstraint("source IN ('auto','manual')"))


class ReviewItem(Base):
    __tablename__ = "review_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("class_sessions.id"), index=True)
    thumbnail_path: Mapped[str | None] = mapped_column(String(100))
    candidates_json: Mapped[str] = mapped_column(Text, default="[]")
    reason: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(10), default="pending")
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(default=now)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    record_id: Mapped[int] = mapped_column(ForeignKey("attendance_records.id"))
    old_status: Mapped[str | None] = mapped_column(String(10))
    new_status: Mapped[str] = mapped_column(String(10))
    reason: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(default=now)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(String(200))


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    message: Mapped[str] = mapped_column(String(500))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=now)


class Challenge(Base):
    __tablename__ = "challenges"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    session_id: Mapped[int] = mapped_column(ForeignKey("class_sessions.id"))
    prompt: Mapped[str] = mapped_column(String(20))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class QRRedemption(Base):
    __tablename__ = "qr_redemptions"
    session_id: Mapped[int] = mapped_column(ForeignKey("class_sessions.id"), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    redeemed_at: Mapped[datetime] = mapped_column(default=now)


class CheckinTicket(Base):
    __tablename__ = "checkin_tickets"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("class_sessions.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    challenge_id: Mapped[str] = mapped_column(ForeignKey("challenges.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=now)


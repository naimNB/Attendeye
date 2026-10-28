from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(Input):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=72)
    portal: Literal["student", "teacher", "admin"] | None = None


class UserIn(Input):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    role: Literal["admin", "teacher", "student"]
    status: Literal["pending", "approved", "rejected", "suspended"] | None = None
    password: str | None = Field(default=None, min_length=10, max_length=72)
    student_code: str | None = Field(default=None, max_length=50)
    staff_id: str | None = Field(default=None, max_length=50)
    department: str | None = Field(default=None, max_length=100)
    batch: str | None = Field(default=None, max_length=50)

    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str) -> str:
        if "@" not in value or value.startswith("@"):
            raise ValueError("Invalid email")
        return value.lower()


class StudentRegisterIn(Input):
    name: str = Field(min_length=1, max_length=120)
    student_code: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=3, max_length=254)
    department: str = Field(min_length=1, max_length=100)
    batch: str | None = Field(default=None, max_length=50)
    password: str = Field(min_length=10, max_length=72)

    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str) -> str:
        if "@" not in value or value.startswith("@"):
            raise ValueError("Invalid email")
        return value.lower()


class TeacherRegisterIn(Input):
    name: str = Field(min_length=1, max_length=120)
    staff_id: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=3, max_length=254)
    department: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=10, max_length=72)

    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str) -> str:
        if "@" not in value or value.startswith("@"):
            raise ValueError("Invalid email")
        return value.lower()


class ApprovalIn(Input):
    verification_method: Literal["institutional_roster", "in_person_id", "department_records"]


class RejectionIn(Input):
    reason: str = Field(min_length=3, max_length=500)


class SuspensionIn(Input):
    reason: str = Field(min_length=3, max_length=500)


class CourseIn(Input):
    code: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=150)


class SectionIn(Input):
    course_id: int
    name: str = Field(min_length=1, max_length=80)
    room: str | None = Field(default=None, max_length=80)


class EnrolmentIn(Input):
    student_id: int
    section_id: int


class AssignmentIn(Input):
    teacher_id: int
    section_id: int


class SettingsIn(Input):
    attendance_limit: float = Field(default=75, ge=0, le=100)
    t_low: float = Field(default=.35, ge=0, le=1)
    t_high: float = Field(default=.50, ge=0, le=1)
    margin: float = Field(default=.05, ge=0, le=1)

    @model_validator(mode="after")
    def ordered(self) -> "SettingsIn":
        if self.t_low >= self.t_high:
            raise ValueError("t_low must be smaller than t_high")
        return self


class ConsentIn(Input):
    accepted: Literal[True]
    text_version: Literal["1.0"] = "1.0"


class SessionIn(Input):
    section_id: int
    starts_at: datetime
    ends_at: datetime
    require_qr: bool = False
    room: str | None = Field(default=None, max_length=80)

    @field_validator("starts_at", "ends_at")
    @classmethod
    def utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("Supply a timezone offset")
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    @model_validator(mode="after")
    def window(self) -> "SessionIn":
        if not 0 < (self.ends_at - self.starts_at).total_seconds() <= 12 * 3600:
            raise ValueError("Session must last between 0 and 12 hours")
        return self


class Correction(Input):
    status: Literal["present", "absent"]
    reason: str = Field(min_length=3, max_length=500)


class Resolution(Input):
    student_id: int | None = None
    reason: str = Field(min_length=3, max_length=500)


class ChallengeIn(Input):
    session_id: int
    mode: Literal["random", "blink"] = "random"


class CheckinStartIn(Input):
    session_id: int
    qr_token: str = Field(min_length=10)
    mode: Literal["random", "blink"] = "random"


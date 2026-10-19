"""Fake accounts only; never seed face images, embeddings or assumed biometric consent."""
import argparse
import os
import random
import sys
from datetime import timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select
from app.config import settings
from app.database import Base, engine, SessionLocal
from app.models import User, Course, Section, Enrolment, TeacherAssignment, ClassSession, ReviewItem, now
from app.security import hash_password
from app.services.attendance import set_record, notify_section


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo-sessions", action="store_true", help="Create 20 explicitly DEMO closed sessions")
    args = parser.parse_args()
    settings.validate()
    password = os.getenv("SEED_PASSWORD", "")
    if len(password.encode()) < 10:
        raise SystemExit("Set SEED_PASSWORD to at least 10 bytes in backend/.env")
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        def user(email: str, name: str, role: str, code: str | None = None) -> User:
            row = db.scalar(select(User).where(User.email == email))
            if row is None:
                row = User(email=email, name=name, role=role, student_code=code, password_hash=hash_password(password))
                db.add(row); db.flush()
            return row
        admin = user("admin@demo.invalid", "DEMO Administrator", "admin")
        teachers = [user(f"teacher{i}@demo.invalid", f"DEMO Teacher {i}", "teacher") for i in (1, 2)]
        students = [user(f"student{i}@demo.invalid", f"DEMO Student {i:02d}", "student", f"DEMO-{i:03d}") for i in range(1, 9)]
        sections = []
        for i, title in enumerate(["Computer Vision", "Database Systems"], 1):
            course = db.scalar(select(Course).where(Course.code == f"DEMO-CSE{i}01"))
            if course is None:
                course = Course(code=f"DEMO-CSE{i}01", title=f"DEMO {title}"); db.add(course); db.flush()
            section = db.scalar(select(Section).where(Section.course_id == course.id, Section.name == "DEMO-A"))
            if section is None:
                section = Section(course_id=course.id, name="DEMO-A"); db.add(section); db.flush()
            sections.append(section)
            db.merge(TeacherAssignment(teacher_id=teachers[i - 1].id, section_id=section.id))
            for student in students: db.merge(Enrolment(student_id=student.id, section_id=section.id))
        if args.demo_sessions:
            existing = db.scalar(select(ClassSession.id).where(ClassSession.is_demo.is_(True)).limit(1))
            if existing:
                print("DEMO sessions already exist; not duplicating.")
            else:
                rng = random.Random(42)
                for i in range(20):
                    section = sections[i % 2]
                    start = now() - timedelta(days=21 - i)
                    session = ClassSession(section_id=section.id, teacher_id=teachers[i % 2].id,
                                           starts_at=start, ends_at=start + timedelta(hours=1),
                                           status="closed", closed_at=start + timedelta(hours=1), is_demo=True)
                    db.add(session); db.flush()
                    for j, student in enumerate(students):
                        present = rng.random() > (.5 if j == 0 or (j == 1 and i > 10) else .15)
                        record = set_record(db, session.id, student.id, "present" if present else "absent", source="auto")
                        if j == 2 and i % 4 == 0:
                            set_record(db, session.id, student.id, "present", source="manual", actor_id=teachers[i % 2].id,
                                       reason="DEMO: teacher verified late arrival")
                    db.add(ReviewItem(session_id=session.id, reason="unknown", candidates_json="[]", status="pending"))
                db.flush()
                for section in sections: notify_section(db, section.id)
        db.commit()
    print("Seed complete: admin@demo.invalid, teacher1/teacher2@demo.invalid, student1..student8@demo.invalid.")
    print("Password is SEED_PASSWORD in your private .env. No biometric data or consent was generated.")


if __name__ == "__main__":
    main()

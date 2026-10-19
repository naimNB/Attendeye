"""Tests use isolated synthetic data, temporary SQLite and generated test keys."""
import os
import tempfile
from pathlib import Path
from cryptography.fernet import Fernet

_test_root = tempfile.TemporaryDirectory(prefix="attendeye-tests-")
os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(_test_root.name) / "test.db")
os.environ["FERNET_KEY"] = Fernet.generate_key().decode()
os.environ["JWT_SECRET"] = "test-only-secret-" * 4
os.environ["PRIVATE_DIR"] = str(Path(_test_root.name) / "private")
os.environ["DEBUG_RECOGNITION"] = "false"
os.environ["ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver"
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import User, Course, Section, TeacherAssignment, Enrolment
from app.security import hash_password, token


@pytest.fixture
def db():
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    with SessionLocal() as session:
        yield session
        session.rollback()


@pytest.fixture
def accounts(db):
    users = [User(name=role, email=f"{role}@example.invalid", role=actual, password_hash=hash_password("Testing12345!"))
             for role, actual in [("admin", "admin"), ("teacher", "teacher"), ("outsider", "teacher"), ("student", "student"), ("other", "student")]]
    db.add_all(users); db.flush()
    course = Course(code="TEST", title="Test Course"); db.add(course); db.flush()
    section = Section(course_id=course.id, name="A"); db.add(section); db.flush()
    db.add(TeacherAssignment(teacher_id=users[1].id, section_id=section.id))
    for user in users[3:]: db.add(Enrolment(student_id=user.id, section_id=section.id))
    db.commit()
    return {**dict(zip(["admin", "teacher", "outsider", "student", "other"], users)), "section": section}


@pytest.fixture
def client(db):
    with TestClient(app) as client:
        yield client


def headers(user):
    return {"Authorization": "Bearer " + token({"sub": str(user.id)}, "access", 60)}

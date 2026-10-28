from datetime import timedelta
import json
import numpy as np
import pytest
from sqlalchemy import select
from app.models import (
    User,
    Course,
    Section,
    Enrolment,
    Consent,
    FaceEmbedding,
    ClassSession,
    AttendanceRecord,
    ReviewItem,
    QRRedemption,
    Setting,
    now,
)
from app.security import encrypt_vector, hash_password, token
from app.services.face_engine import Face
from app.services.matching import Match
from app.services.recognition import gallery_for, capture, Observation
from conftest import headers


def synthetic_vector(val: float = 1.0) -> np.ndarray:
    v = np.zeros(512, dtype=np.float32)
    v[0] = val
    return v / np.linalg.norm(v)


def mock_face(vector=None):
    if vector is None:
        vector = synthetic_vector()
    points = np.zeros((68, 3))
    return Face(
        box=np.array([10, 10, 80, 80]),
        vector=vector,
        landmarks=points,
        yaw=0.0,
        pitch=0.0,
        crop=np.zeros((60, 60, 3), dtype=np.uint8),
        detection_score=0.99,
        quality_reasons=[],
    )


def enrol_biometrics(db, user_id: int, vector=None):
    if vector is None:
        vector = synthetic_vector()
    db.add(Consent(student_id=user_id, text_version="1.0"))
    for pose in ["front", "left", "right", "up", "down"]:
        db.add(
            FaceEmbedding(
                student_id=user_id,
                vector_encrypted=encrypt_vector(vector),
                pose_label=pose,
            )
        )
    db.commit()


def create_open_session(db, accounts):
    row = ClassSession(
        section_id=accounts["section"].id,
        teacher_id=accounts["teacher"].id,
        starts_at=now() - timedelta(minutes=5),
        ends_at=now() + timedelta(minutes=15),
        status="open",
        require_qr=False,
    )
    db.add(row)
    db.commit()
    return row


def test_gallery_for_approved_student_is_eligible(db, accounts):
    student = accounts["student"]
    enrol_biometrics(db, student.id)
    gallery = gallery_for(db, accounts["section"].id)
    assert student.id in gallery
    assert len(gallery[student.id]) == 5


def test_gallery_for_excludes_pending_rejected_suspended(db, accounts):
    section = accounts["section"]
    for st in ["pending", "rejected", "suspended"]:
        user = User(
            name=f"Student {st}",
            email=f"{st}@example.invalid",
            role="student",
            status=st,
            password_hash=hash_password("Pass12345!"),
        )
        db.add(user)
        db.flush()
        db.add(Enrolment(student_id=user.id, section_id=section.id))
        enrol_biometrics(db, user.id)

        gallery = gallery_for(db, section.id)
        assert user.id not in gallery, f"Student with status {st} must be excluded from gallery"


def test_gallery_for_excludes_non_students(db, accounts):
    section = accounts["section"]
    for role in ["teacher", "admin"]:
        user = User(
            name=f"User {role}",
            email=f"{role}_test@example.invalid",
            role=role,
            status="approved",
            password_hash=hash_password("Pass12345!"),
        )
        db.add(user)
        db.flush()
        db.add(Enrolment(student_id=user.id, section_id=section.id))
        enrol_biometrics(db, user.id)

        gallery = gallery_for(db, section.id)
        assert user.id not in gallery, f"User with role {role} must be excluded from student gallery"


def test_gallery_for_excludes_revoked_consent_and_missing_enrolment(db, accounts):
    section = accounts["section"]

    # 1. Revoked consent
    revoked_student = User(
        name="Revoked Student",
        email="revoked@example.invalid",
        role="student",
        status="approved",
        password_hash=hash_password("Pass12345!"),
    )
    db.add(revoked_student)
    db.flush()
    db.add(Enrolment(student_id=revoked_student.id, section_id=section.id))
    enrol_biometrics(db, revoked_student.id)
    # Revoke consent
    consent_record = db.scalar(
        select(Consent).where(Consent.student_id == revoked_student.id)
    )
    consent_record.revoked_at = now()
    db.commit()

    # 2. Approved and consented student enrolled in another section
    course = db.get(Course, section.course_id)
    other_section = Section(course_id=course.id, name="OtherSection")
    db.add(other_section)
    db.flush()

    other_student = User(
        name="Other Student",
        email="other_sec@example.invalid",
        role="student",
        status="approved",
        password_hash=hash_password("Pass12345!"),
    )
    db.add(other_student)
    db.flush()
    db.add(Enrolment(student_id=other_student.id, section_id=other_section.id))
    enrol_biometrics(db, other_student.id)

    # 3. Incomplete poses (only 3 poses)
    incomplete_student = User(
        name="Incomplete Student",
        email="incomplete@example.invalid",
        role="student",
        status="approved",
        password_hash=hash_password("Pass12345!"),
    )
    db.add(incomplete_student)
    db.flush()
    db.add(Enrolment(student_id=incomplete_student.id, section_id=section.id))
    db.add(Consent(student_id=incomplete_student.id, text_version="1.0"))
    for pose in ["front", "left", "right"]:
        db.add(
            FaceEmbedding(
                student_id=incomplete_student.id,
                vector_encrypted=encrypt_vector(synthetic_vector()),
                pose_label=pose,
            )
        )
    db.commit()

    gallery = gallery_for(db, section.id)
    assert revoked_student.id not in gallery
    assert other_student.id not in gallery
    assert incomplete_student.id not in gallery


def test_photo_capture_eligibility_changed_during_inference(db, accounts, monkeypatch):
    from app.services import recognition as rec_module

    session = create_open_session(db, accounts)
    student = accounts["student"]
    sid = student.id
    enrol_biometrics(db, sid)

    # Mock analyse to simulate suspension occurring during heavy inference
    f = mock_face()

    def fake_analyse(data, gallery, limits):
        # Modify the student's status directly in the database during inference
        target = db.get(User, sid)
        target.status = "suspended"
        db.commit()
        # Return an auto match for the student based on initial pre-inference gallery
        return Observation(
            [f],
            [Match(0, sid, 0.88, 0.38, "auto", [{"student_id": sid, "score": 0.88}], candidate_id=sid)],
            100,
            100,
        )

    monkeypatch.setattr(rec_module, "analyse", fake_analyse)

    res = capture(db, session, [b"image-data-1"])

    # 1. Suspended student must NOT be in accepted results
    accepted_ids = [a["student_id"] for a in res["accepted"]]
    assert sid not in accepted_ids

    # 2. Suspended student must NOT receive an automatic-present record
    db.expire_all()
    rec = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == session.id,
            AttendanceRecord.student_id == sid,
        )
    )
    assert rec is None or rec.status != "present"

    # 3. A review item was created, but the ineligible student must NOT appear in candidates
    assert len(res["review_ids"]) == 1
    review_item = db.get(ReviewItem, res["review_ids"][0])
    candidates = json.loads(review_item.candidates_json)
    assert not any(c["student_id"] == sid for c in candidates)
    assert review_item.reason == "unknown"

    # 4. Existing biometrics and account exist (suspension does not delete them)
    embeddings = list(
        db.scalars(select(FaceEmbedding).where(FaceEmbedding.student_id == sid))
    )
    assert len(embeddings) == 5
    assert db.get(User, sid).status == "suspended"


def test_burst_capture_eligibility_changed_during_inference(db, accounts, monkeypatch):
    from app.services import recognition as rec_module

    session = create_open_session(db, accounts)
    student_a = accounts["student"]
    sid_a = student_a.id
    enrol_biometrics(db, sid_a)

    student_b = accounts["other"]
    sid_b = student_b.id
    enrol_biometrics(db, sid_b)

    f_a = mock_face(synthetic_vector(1.0))
    f_b = mock_face(synthetic_vector(-1.0))

    def fake_analyse(data, gallery, limits):
        # Suspend student A on first frame, leave student B approved
        target_a = db.get(User, sid_a)
        target_a.status = "suspended"
        db.commit()

        return Observation(
            [f_a, f_b],
            [
                Match(0, sid_a, 0.90, 0.40, "auto", [{"student_id": sid_a, "score": 0.90}], candidate_id=sid_a),
                Match(1, sid_b, 0.85, 0.35, "auto", [{"student_id": sid_b, "score": 0.85}], candidate_id=sid_b),
            ],
            200,
            100,
        )

    monkeypatch.setattr(rec_module, "analyse", fake_analyse)

    # 5 frames for burst
    images = [f"burst-frame-{i}".encode() for i in range(5)]
    res = capture(db, session, images)

    accepted_ids = [a["student_id"] for a in res["accepted"]]
    # Student B was approved throughout and receives attendance
    assert sid_b in accepted_ids
    # Student A was suspended during inference and must NOT receive attendance
    assert sid_a not in accepted_ids

    db.expire_all()
    rec_b = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == session.id,
            AttendanceRecord.student_id == sid_b,
        )
    )
    assert rec_b is not None and rec_b.status == "present"

    rec_a = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == session.id,
            AttendanceRecord.student_id == sid_a,
        )
    )
    assert rec_a is None or rec_a.status != "present"

    # Ineligible student A must not appear as a selectable candidate in review items
    for item_id in res["review_ids"]:
        item = db.get(ReviewItem, item_id)
        candidates = json.loads(item.candidates_json)
        assert not any(c["student_id"] == sid_a for c in candidates)


def test_qr_checkin_eligibility_changed_during_inference(db, accounts, client, monkeypatch):
    from app.routers import checkin as checkin_router
    from app.routers.checkin import qr_window
    from app.services.challenges import issue

    session = create_open_session(db, accounts)
    session.require_qr = True
    db.commit()

    student = accounts["student"]
    sid = student.id
    enrol_biometrics(db, sid)

    f = mock_face()
    monkeypatch.setattr(checkin_router, "validate_motion", lambda faces, prompt: True)

    def fake_analyse(data, gallery, limits):
        # Suspend student during facial analysis
        target = db.get(User, sid)
        target.status = "suspended"
        db.commit()
        return Observation([f], [Match(0, sid, 0.95, 0.50, "auto", [], candidate_id=sid)], 100, 100)

    monkeypatch.setattr(checkin_router, "analyse", fake_analyse)

    challenge = issue(db, sid, session.id)
    qr_tok = token({"sid": session.id, "window": qr_window()}, "qr", 30)

    # Attempt check-in
    response = client.post(
        f"/checkin/{session.id}",
        headers=headers(student),
        data={"qr_token": qr_tok, "challenge_token": challenge["token"]},
        files=[("frames", (f"{i}.jpg", f"frame-{i}".encode(), "image/jpeg")) for i in range(5)],
    )

    assert response.status_code == 409
    assert "eligible" in response.json()["detail"].lower()

    db.expire_all()
    assert db.get(QRRedemption, (session.id, sid)) is None
    assert db.scalar(select(AttendanceRecord).where(AttendanceRecord.session_id == session.id)) is None

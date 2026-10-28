import pytest
from datetime import timedelta
from app.models import User, Course, Section, TeacherAssignment, Enrolment, ClassSession, Consent, FaceEmbedding, AttendanceRecord, ReviewItem, now
from app.security import hash_password, token, encrypt_vector
from tests.conftest import headers
import numpy as np


def mock_vectors():
    # 5 orthogonal 512D vectors for poses: front, left, right, up, down
    rng = np.random.RandomState(42)
    vecs = []
    for _ in range(5):
        v = rng.randn(512).astype(np.float32)
        v /= np.linalg.norm(v)
        vecs.append(v)
    return vecs


class TestOnboardingWorkflow:
    def test_student_registration_to_approval_and_enrolment(self, client, db):
        # 1. Student registers
        reg_resp = client.post("/auth/register/student", json={
            "name": "Alice Wonderland",
            "email": "alice@university.invalid",
            "student_code": "2026-CS-001",
            "department": "Computer Science",
            "batch": "2026",
            "password": "Password12345!",
        })
        assert reg_resp.status_code == 201
        student_id = reg_resp.json()["user"]["id"]

        # Student status is pending
        student = db.get(User, student_id)
        assert student.status == "pending"

        # Pending student cannot access student-protected endpoints
        student_tok = headers(student)
        enrol_resp = client.get("/enrol/status", headers=student_tok)
        assert enrol_resp.status_code == 403

        # 2. Admin inspects registration requests
        admin = User(name="Admin", email="admin@univ.invalid", role="admin", password_hash=hash_password("Pass1234567!"), status="approved")
        db.add(admin); db.commit()
        admin_tok = headers(admin)

        reqs = client.get("/registration-requests?status=pending", headers=admin_tok).json()
        assert any(r["id"] == student_id for r in reqs)

        # 3. Admin approves application with verification method
        appr_resp = client.post(f"/registration-requests/{student_id}/approve", json={
            "verification_method": "institutional_roster"
        }, headers=admin_tok)
        assert appr_resp.status_code == 200
        db.refresh(student)
        assert student.status == "approved"
        assert student.verified_method == "institutional_roster"

        # 4. Approved student can now access profile & biometric enrolment
        status_resp = client.get("/enrol/status", headers=student_tok)
        assert status_resp.status_code == 200
        assert status_resp.json()["complete"] is False

        # 5. Provide consent and complete face enrolment
        consent_resp = client.post("/enrol/consent", json={"accepted": True, "text_version": "1.0"}, headers=student_tok)
        assert consent_resp.status_code == 200

        # Simulate storing 5 poses for student
        poses = ["front", "left", "right", "up", "down"]
        vecs = mock_vectors()
        for p, v in zip(poses, vecs):
            db.add(FaceEmbedding(student_id=student.id, vector_encrypted=encrypt_vector(v), pose_label=p))
        db.commit()

        status_resp2 = client.get("/enrol/status", headers=student_tok)
        assert status_resp2.json()["complete"] is True
        assert status_resp2.json()["count"] == 5

        # 6. Admin assigns approved student to section
        course = Course(code="CS-101", title="Intro to CS")
        db.add(course); db.commit()
        section = Section(course_id=course.id, name="Section 1", room="Room 204")
        db.add(section); db.commit()

        assign_resp = client.post("/enrolments", json={
            "student_id": student.id,
            "section_id": section.id,
        }, headers=admin_tok)
        assert assign_resp.status_code == 201

        # Check section roster
        roster_resp = client.get(f"/sections/{section.id}/roster", headers=admin_tok)
        assert roster_resp.status_code == 200
        roster = roster_resp.json()
        assert len(roster) == 1
        assert roster[0]["id"] == student.id
        assert roster[0]["biometric_enrolled"] is True


class TestStrictSectionIsolation:
    @pytest.fixture
    def setup_data(self, db):
        # Create admin
        admin = User(name="Admin", email="admin@univ.invalid", role="admin", password_hash=hash_password("Pass1234567!"), status="approved")
        # Create Teacher A and Teacher B
        teacher_a = User(name="Prof A", email="teacher_a@univ.invalid", role="teacher", password_hash=hash_password("Pass1234567!"), status="approved")
        teacher_b = User(name="Prof B", email="teacher_b@univ.invalid", role="teacher", password_hash=hash_password("Pass1234567!"), status="approved")
        # Create Student A (enrolled only in Course 1 Section A)
        student_a = User(name="Student A", email="student_a@univ.invalid", role="student", password_hash=hash_password("Pass1234567!"), status="approved")
        # Create Student B (enrolled only in Course 2 Section A)
        student_b = User(name="Student B", email="student_b@univ.invalid", role="student", password_hash=hash_password("Pass1234567!"), status="approved")
        # Create Student Both (enrolled in both)
        student_both = User(name="Student Both", email="student_both@univ.invalid", role="student", password_hash=hash_password("Pass1234567!"), status="approved")
        db.add_all([admin, teacher_a, teacher_b, student_a, student_b, student_both])
        db.flush()

        # Two courses
        course1 = Course(code="CSE-301", title="Algorithms")
        course2 = Course(code="CSE-302", title="Databases")
        db.add_all([course1, course2])
        db.flush()

        # Both have a section named "Section A" with different rooms
        sec_1a = Section(course_id=course1.id, name="Section A", room="Lab 101")
        sec_2a = Section(course_id=course2.id, name="Section A", room="Lab 202")
        db.add_all([sec_1a, sec_2a])
        db.flush()

        # Assignments
        db.add(TeacherAssignment(teacher_id=teacher_a.id, section_id=sec_1a.id))
        db.add(TeacherAssignment(teacher_id=teacher_b.id, section_id=sec_2a.id))

        # Enrolments
        db.add(Enrolment(student_id=student_a.id, section_id=sec_1a.id))
        db.add(Enrolment(student_id=student_b.id, section_id=sec_2a.id))
        db.add(Enrolment(student_id=student_both.id, section_id=sec_1a.id))
        db.add(Enrolment(student_id=student_both.id, section_id=sec_2a.id))

        # Face enrolments for all three students
        vecs = mock_vectors()
        for s in [student_a, student_b, student_both]:
            db.add(Consent(student_id=s.id, text_version="1.0"))
            for p, v in zip(["front", "left", "right", "up", "down"], vecs):
                db.add(FaceEmbedding(student_id=s.id, vector_encrypted=encrypt_vector(v), pose_label=p))
        db.commit()

        return {
            "admin": admin,
            "teacher_a": teacher_a,
            "teacher_b": teacher_b,
            "student_a": student_a,
            "student_b": student_b,
            "student_both": student_both,
            "sec_1a": sec_1a,
            "sec_2a": sec_2a,
        }

    def test_teacher_cannot_create_session_for_unassigned_section(self, client, setup_data):
        teacher_a_tok = headers(setup_data["teacher_a"])
        start = now() + timedelta(minutes=5)
        end = start + timedelta(hours=1)

        # Teacher A attempts to create a session in Section 2A (assigned to Teacher B)
        resp = client.post("/sessions", json={
            "section_id": setup_data["sec_2a"].id,
            "starts_at": start.isoformat() + "Z",
            "ends_at": end.isoformat() + "Z",
        }, headers=teacher_a_tok)
        assert resp.status_code == 403

    def test_session_inherits_room_and_allows_override(self, client, setup_data):
        teacher_a_tok = headers(setup_data["teacher_a"])
        start = now() + timedelta(minutes=5)
        end = start + timedelta(hours=1)

        # 1. Create without room override -> inherits "Lab 101"
        resp1 = client.post("/sessions", json={
            "section_id": setup_data["sec_1a"].id,
            "starts_at": start.isoformat() + "Z",
            "ends_at": end.isoformat() + "Z",
        }, headers=teacher_a_tok)
        assert resp1.status_code == 201
        assert resp1.json()["room"] == "Lab 101"

        # 2. Create with room override -> uses override "Auditorium"
        start2 = now() + timedelta(hours=2)
        end2 = start2 + timedelta(hours=1)
        resp2 = client.post("/sessions", json={
            "section_id": setup_data["sec_1a"].id,
            "starts_at": start2.isoformat() + "Z",
            "ends_at": end2.isoformat() + "Z",
            "room": "Auditorium",
        }, headers=teacher_a_tok)
        assert resp2.status_code == 201
        assert resp2.json()["room"] == "Auditorium"

    def test_teacher_cannot_access_other_teacher_session(self, client, setup_data, db):
        # Teacher B creates session in Section 2A
        start = now() - timedelta(minutes=5)
        end = start + timedelta(hours=1)
        session_2a = ClassSession(section_id=setup_data["sec_2a"].id, teacher_id=setup_data["teacher_b"].id,
                                  starts_at=start, ends_at=end, status="open")
        db.add(session_2a); db.commit()

        # Teacher A attempts to view session 2A details
        teacher_a_tok = headers(setup_data["teacher_a"])
        resp = client.get(f"/sessions/{session_2a.id}", headers=teacher_a_tok)
        assert resp.status_code == 403

        # Teacher A attempts to view session 2A roster
        assert client.get(f"/sessions/{session_2a.id}/roster", headers=teacher_a_tok).status_code == 403

        # Teacher A attempts to close session 2A
        assert client.post(f"/sessions/{session_2a.id}/close", headers=teacher_a_tok).status_code == 403

        # Teacher A attempts to view records of session 2A
        assert client.get(f"/sessions/{session_2a.id}/records", headers=teacher_a_tok).status_code == 403

    def test_student_cross_section_access_is_blocked(self, client, setup_data, db):
        # Teacher B creates open session with QR requirement in Section 2A
        start = now() - timedelta(minutes=5)
        end = start + timedelta(hours=1)
        session_2a = ClassSession(section_id=setup_data["sec_2a"].id, teacher_id=setup_data["teacher_b"].id,
                                  starts_at=start, ends_at=end, status="open", require_qr=True)
        db.add(session_2a); db.commit()

        # Student A (enrolled only in Section 1A) tries to access checkin_start for session 2A
        student_a_tok = headers(setup_data["student_a"])
        resp = client.post("/checkin/start", json={
            "session_id": session_2a.id,
            "qr_token": "some_random_token_string",
        }, headers=student_a_tok)
        assert resp.status_code == 403

    def test_cross_section_review_resolution_is_rejected(self, client, setup_data, db):
        # Session in Section 2A has a review item
        session_2a = ClassSession(section_id=setup_data["sec_2a"].id, teacher_id=setup_data["teacher_b"].id,
                                  starts_at=now() - timedelta(minutes=10), ends_at=now() + timedelta(hours=1),
                                  status="open")
        db.add(session_2a); db.flush()
        review_item = ReviewItem(session_id=session_2a.id, reason="ambiguous", status="pending")
        db.add(review_item); db.commit()

        # Teacher B attempts to resolve review item by assigning Student A (enrolled only in Section 1A)
        teacher_b_tok = headers(setup_data["teacher_b"])
        resp = client.post(f"/review/{review_item.id}/resolve", json={
            "student_id": setup_data["student_a"].id,
            "reason": "Visual confirmation from teacher",
        }, headers=teacher_b_tok)
        assert resp.status_code == 422
        assert "not on this class roster" in resp.json()["detail"].lower()

    def test_cross_section_manual_attendance_correction_is_rejected(self, client, setup_data, db):
        # Session in Section 2A has attendance record
        session_2a = ClassSession(section_id=setup_data["sec_2a"].id, teacher_id=setup_data["teacher_b"].id,
                                  starts_at=now() - timedelta(minutes=10), ends_at=now() + timedelta(hours=1),
                                  status="open")
        db.add(session_2a); db.flush()
        # Pretend an attendance record somehow existed for Student A
        rec = AttendanceRecord(session_id=session_2a.id, student_id=setup_data["student_a"].id, status="absent", source="manual")
        db.add(rec); db.commit()

        # Attempt to correct attendance
        teacher_b_tok = headers(setup_data["teacher_b"])
        resp = client.put(f"/attendance/{rec.id}", json={
            "status": "present",
            "reason": "Excused university absence",
        }, headers=teacher_b_tok)
        assert resp.status_code == 422
        assert "not enrolled in this section" in resp.json()["detail"].lower()

    def test_reports_and_analytics_strict_isolation(self, client, setup_data, db):
        teacher_a_tok = headers(setup_data["teacher_a"])
        teacher_b_tok = headers(setup_data["teacher_b"])

        # Teacher A cannot access Section 2A's course report
        resp = client.get(f"/reports/course/{setup_data['sec_2a'].id}", headers=teacher_a_tok)
        assert resp.status_code == 403

        # Teacher B cannot access Section 1A's course report
        resp2 = client.get(f"/reports/course/{setup_data['sec_1a'].id}", headers=teacher_b_tok)
        assert resp2.status_code == 403

        # Analytics: Teacher A querying Section 2A gets 403
        resp3 = client.get(f"/analytics?section_id={setup_data['sec_2a'].id}", headers=teacher_a_tok)
        assert resp3.status_code == 403

    def test_checkin_ticket_challenge_binding(self, client, setup_data, db):
        # Student A is enrolled in sec_1a
        s1 = setup_data["student_a"]
        teacher_a = setup_data["teacher_a"]
        sec = setup_data["sec_1a"]

        # Active open session with QR required
        session = ClassSession(
            section_id=sec.id,
            teacher_id=teacher_a.id,
            starts_at=now() - timedelta(minutes=5),
            ends_at=now() + timedelta(hours=1),
            status="open",
            require_qr=True,
        )
        db.add(session); db.commit()

        # Teacher gets QR token
        qr_resp = client.get(f"/sessions/{session.id}/qr", headers=headers(teacher_a))
        assert qr_resp.status_code == 200
        qr_token = qr_resp.json()["token"]

        # Student starts checkin
        start_resp = client.post("/checkin/start", json={
            "session_id": session.id,
            "qr_token": qr_token,
            "mode": "random",
        }, headers=headers(s1))
        assert start_resp.status_code == 200
        ticket_token = start_resp.json()["ticket_token"]

        # Create an unrelated challenge token
        from app.services.challenges import issue
        unrelated_chal = issue(db, s1.id, session.id, mode="random")
        unrelated_token = unrelated_chal["token"]

        # Submitting ticket with mismatched challenge token must be rejected (403)
        bad_checkin = client.post(f"/checkin/{session.id}", data={
            "ticket_token": ticket_token,
            "challenge_token": unrelated_token,
        }, files=[("frames", (f"f{i}.jpg", b"fake-frame", "image/jpeg")) for i in range(5)], headers=headers(s1))
        assert bad_checkin.status_code == 403
        assert "bound to a different challenge" in bad_checkin.json()["detail"].lower()


class TestAdminManagementAndRosterIntegrity:
    def test_cannot_assign_unapproved_user_or_duplicate(self, client, db):
        admin = User(name="Admin", email="admin@univ.invalid", role="admin", password_hash=hash_password("Pass1234567!"), status="approved")
        db.add(admin); db.commit()
        admin_tok = headers(admin)

        course = Course(code="CS-999", title="Special Topics")
        db.add(course); db.commit()
        sec = Section(course_id=course.id, name="Sec 1", room="R101")
        db.add(sec); db.commit()

        # Pending teacher
        teacher = User(name="Pending Teacher", email="p_teacher@univ.invalid", role="teacher", password_hash=hash_password("Pass1234567!"), status="pending")
        # Pending student
        student = User(name="Pending Student", email="p_student@univ.invalid", role="student", password_hash=hash_password("Pass1234567!"), status="pending")
        db.add_all([teacher, student]); db.commit()

        # Assign unapproved teacher -> 422
        resp_t = client.post("/teacher-assignments", json={
            "teacher_id": teacher.id,
            "section_id": sec.id,
        }, headers=admin_tok)
        assert resp_t.status_code == 422
        assert "approved first" in resp_t.json()["detail"]

        # Enrol unapproved student -> 422
        resp_s = client.post("/enrolments", json={
            "student_id": student.id,
            "section_id": sec.id,
        }, headers=admin_tok)
        assert resp_s.status_code == 422
        assert "approved first" in resp_s.json()["detail"]

        # Approve both
        teacher.status = "approved"
        student.status = "approved"
        db.commit()

        # Enrol approved student -> 201
        assert client.post("/enrolments", json={"student_id": student.id, "section_id": sec.id}, headers=admin_tok).status_code == 201
        # Duplicate enrolment -> 409
        dup_s = client.post("/enrolments", json={"student_id": student.id, "section_id": sec.id}, headers=admin_tok)
        assert dup_s.status_code == 409
        assert "already enrolled" in dup_s.json()["detail"]

        # Assign approved teacher -> 201
        assert client.post("/teacher-assignments", json={"teacher_id": teacher.id, "section_id": sec.id}, headers=admin_tok).status_code == 201
        # Duplicate assignment -> 409
        dup_t = client.post("/teacher-assignments", json={"teacher_id": teacher.id, "section_id": sec.id}, headers=admin_tok)
        assert dup_t.status_code == 409
        assert "already assigned" in dup_t.json()["detail"]

    def test_roster_freeze_after_session(self, client, db):
        admin = User(name="Admin", email="admin@univ.invalid", role="admin", password_hash=hash_password("Pass1234567!"), status="approved")
        teacher = User(name="Teacher", email="teacher@univ.invalid", role="teacher", password_hash=hash_password("Pass1234567!"), status="approved")
        student1 = User(name="Student 1", email="s1@univ.invalid", role="student", password_hash=hash_password("Pass1234567!"), status="approved")
        student2 = User(name="Student 2", email="s2@univ.invalid", role="student", password_hash=hash_password("Pass1234567!"), status="approved")
        db.add_all([admin, teacher, student1, student2]); db.commit()
        admin_tok = headers(admin)

        course = Course(code="MATH-101", title="Calculus")
        db.add(course); db.commit()
        sec = Section(course_id=course.id, name="Section A", room="Math Hall 1")
        db.add(sec); db.commit()

        # Enrol student 1
        client.post("/enrolments", json={"student_id": student1.id, "section_id": sec.id}, headers=admin_tok)
        client.post("/teacher-assignments", json={"teacher_id": teacher.id, "section_id": sec.id}, headers=admin_tok)

        # Create session
        session = ClassSession(section_id=sec.id, teacher_id=teacher.id, starts_at=now(), ends_at=now() + timedelta(hours=1), status="open")
        db.add(session); db.commit()

        # Attempt to enrol student 2 on frozen section -> 409
        resp_enrol = client.post("/enrolments", json={"student_id": student2.id, "section_id": sec.id}, headers=admin_tok)
        assert resp_enrol.status_code == 409
        assert "roster is frozen" in resp_enrol.json()["detail"].lower()

        # Attempt to delete student 1 from frozen section -> 409
        resp_del = client.delete(f"/enrolments/{student1.id}/{sec.id}", headers=admin_tok)
        assert resp_del.status_code == 409

        # Safe update to section room and name is PERMITTED
        update_resp = client.put(f"/sections/{sec.id}", json={
            "course_id": course.id,
            "name": "Section A (Updated Room)",
            "room": "Math Hall 2",
        }, headers=admin_tok)
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == "Section A (Updated Room)"
        assert update_resp.json()["room"] == "Math Hall 2"
        assert update_resp.json()["roster_frozen"] is True

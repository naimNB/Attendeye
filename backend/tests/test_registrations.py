import pytest
from conftest import headers


def test_student_registration_success(client, accounts):
    payload = {
        "name": "Alice Wonderland",
        "student_code": "2026-CSE-999",
        "email": "alice.w@university.edu",
        "department": "Computer Science & Engineering",
        "batch": "52nd",
        "password": "StrongPassword123!",
    }
    res = client.post("/auth/register/student", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["registered"] is True
    assert "user" in data
    user = data["user"]
    assert user["name"] == "Alice Wonderland"
    assert user["email"] == "alice.w@university.edu"
    assert user["student_code"] == "2026-CSE-999"
    assert user["department"] == "Computer Science & Engineering"
    assert user["batch"] == "52nd"
    assert user["role"] == "student"
    assert user["status"] == "pending"
    assert "password_hash" not in user
    assert "password" not in user


def test_student_registration_extra_fields_forbidden(client, accounts):
    payload = {
        "name": "Hacker Alice",
        "student_code": "2026-CSE-998",
        "email": "hacker@university.edu",
        "department": "CSE",
        "password": "StrongPassword123!",
        "status": "approved",  # Attempt privilege escalation
        "role": "admin",
    }
    res = client.post("/auth/register/student", json=payload)
    assert res.status_code == 422  # Extra fields forbidden by schema


def test_teacher_registration_success(client, accounts):
    payload = {
        "name": "Dr. Bob Faculty",
        "staff_id": "FAC-CSE-888",
        "email": "bob.faculty@university.edu",
        "department": "Computer Science & Engineering",
        "password": "StrongPassword123!",
    }
    res = client.post("/auth/register/teacher", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["registered"] is True
    user = data["user"]
    assert user["name"] == "Dr. Bob Faculty"
    assert user["email"] == "bob.faculty@university.edu"
    assert user["staff_id"] == "FAC-CSE-888"
    assert user["department"] == "Computer Science & Engineering"
    assert user["role"] == "teacher"
    assert user["status"] == "pending"
    assert "password_hash" not in user


def test_duplicate_registration_rejection(client, accounts):
    payload = {
        "name": "Duplicate Student",
        "student_code": "2026-CSE-001",
        "email": "dup@university.edu",
        "department": "CSE",
        "password": "StrongPassword123!",
    }
    # 1. First registration succeeds
    res1 = client.post("/auth/register/student", json=payload)
    assert res1.status_code == 201

    # 2. Duplicate email rejected
    dup_email = {**payload, "student_code": "2026-CSE-002"}
    res2 = client.post("/auth/register/student", json=dup_email)
    assert res2.status_code == 409
    assert "email is already registered" in res2.json()["detail"].lower()

    # 3. Duplicate student code rejected
    dup_code = {**payload, "email": "other@university.edu"}
    res3 = client.post("/auth/register/student", json=dup_code)
    assert res3.status_code == 409
    detail_lower = res3.json()["detail"].lower()
    assert "student code" in detail_lower or "student id" in detail_lower

def test_public_admin_registration_disallowed(client, accounts):
    res = client.post("/auth/register/admin", json={"email": "admin2@demo.invalid"})
    assert res.status_code in (404, 405)


def test_pending_user_access_restrictions(client, accounts):
    # Register a new student
    payload = {
        "name": "Pending Student",
        "student_code": "2026-CSE-777",
        "email": "pending.student@university.edu",
        "department": "CSE",
        "password": "StrongPassword123!",
    }
    res = client.post("/auth/register/student", json=payload)
    assert res.status_code == 201

    # 1. Pending student can sign in to view status
    login_res = client.post("/auth/login", json={
        "email": payload["email"],
        "password": payload["password"],
        "portal": "student"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2. Can call /auth/me
    me_res = client.get("/auth/me", headers=auth_headers)
    assert me_res.status_code == 200
    assert me_res.json()["status"] == "pending"

    # 3. Protected student features are BLOCKED (403)
    att_res = client.get("/attendance/me", headers=auth_headers)
    assert att_res.status_code == 403
    assert "Account is pending" in att_res.json()["detail"]


def test_admin_approval_lifecycle(client, accounts):
    admin_hdr = headers(accounts["admin"])

    # 1. Register student
    reg = client.post("/auth/register/student", json={
        "name": "Candidate Charlie",
        "student_code": "2026-CSE-666",
        "email": "charlie@university.edu",
        "department": "CSE",
        "password": "StrongPassword123!",
    }).json()
    user_id = reg["user"]["id"]

    # 2. Admin lists registration requests
    reqs_res = client.get("/registration-requests?status=pending", headers=admin_hdr)
    assert reqs_res.status_code == 200
    pending_ids = [u["id"] for u in reqs_res.json()]
    assert user_id in pending_ids

    # 3. Admin approves with verification method
    app_res = client.post(f"/registration-requests/{user_id}/approve", json={
        "verification_method": "institutional_roster"
    }, headers=admin_hdr)
    assert app_res.status_code == 200
    assert app_res.json()["approved"] is True
    assert app_res.json()["user"]["status"] == "approved"
    assert app_res.json()["user"]["verified_method"] == "institutional_roster"

    # 4. Audit history records the approval
    hist_res = client.get("/application-history", headers=admin_hdr)
    assert hist_res.status_code == 200
    actions = [h for h in hist_res.json() if h["user_id"] == user_id]
    assert len(actions) >= 1
    assert actions[0]["action"] == "approved"
    assert actions[0]["verification_method"] == "institutional_roster"

    # 5. Now approved student can access protected attendance
    login_res = client.post("/auth/login", json={
        "email": "charlie@university.edu",
        "password": "StrongPassword123!",
        "portal": "student"
    })
    token = login_res.json()["access_token"]
    att_res = client.get("/attendance/me", headers={"Authorization": f"Bearer {token}"})
    assert att_res.status_code == 200


def test_admin_rejection_flow(client, accounts):
    admin_hdr = headers(accounts["admin"])

    # Register student
    reg = client.post("/auth/register/student", json={
        "name": "Invalid Candidate",
        "student_code": "2026-CSE-000",
        "email": "invalid@university.edu",
        "department": "CSE",
        "password": "StrongPassword123!",
    }).json()
    user_id = reg["user"]["id"]

    # Reject application with required reason
    rej_res = client.post(f"/registration-requests/{user_id}/reject", json={
        "reason": "Student ID not found in registrar roster for Spring 2026."
    }, headers=admin_hdr)
    assert rej_res.status_code == 200
    assert rej_res.json()["rejected"] is True
    assert rej_res.json()["user"]["status"] == "rejected"
    assert "Student ID not found" in rej_res.json()["user"]["rejection_reason"]


def test_suspension_immediately_blocks_existing_token(client, accounts):
    admin_hdr = headers(accounts["admin"])
    student = accounts["student"]
    student_hdr = headers(student)

    # 1. Student can initially access protected route
    res1 = client.get("/attendance/me", headers=student_hdr)
    assert res1.status_code == 200

    # 2. Admin suspends student account
    sus_res = client.post(f"/users/{student.id}/suspend", json={
        "reason": "Account suspended pending investigation."
    }, headers=admin_hdr)
    assert sus_res.status_code == 200
    assert sus_res.json()["user"]["status"] == "suspended"

    # 3. Existing access token is IMMEDIATELY rejected with 401 ACCOUNT_UNAVAILABLE
    res2 = client.get("/attendance/me", headers=student_hdr)
    assert res2.status_code == 401
    assert res2.headers.get("X-Error-Code") == "ACCOUNT_UNAVAILABLE"

    # 4. Attempting to login returns 403 ACCOUNT_SUSPENDED
    log_res = client.post("/auth/login", json={
        "email": student.email,
        "password": "Testing12345!",
        "portal": "student"
    })
    assert log_res.status_code == 403
    assert log_res.headers.get("X-Error-Code") == "ACCOUNT_SUSPENDED"

    # 5. Admin reactivates/unsuspends account
    unsus_res = client.post(f"/users/{student.id}/unsuspend", headers=admin_hdr)
    assert unsus_res.status_code == 200
    assert unsus_res.json()["user"]["status"] == "approved"

    # 6. Student can access again
    res3 = client.get("/attendance/me", headers=student_hdr)
    assert res3.status_code == 200

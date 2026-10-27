import pytest
from conftest import headers


def test_student_portal_login_matrix(client, accounts):
    # 1. Valid student in student portal -> 200
    res = client.post('/auth/login', json={
        'email': accounts['student'].email,
        'password': 'Testing12345!',
        'portal': 'student'
    })
    assert res.status_code == 200
    data = res.json()
    assert 'access_token' in data
    assert data['user']['role'] == 'student'

    # 2. Student trying to log into teacher portal -> 403 WRONG_PORTAL
    res_teacher = client.post('/auth/login', json={
        'email': accounts['student'].email,
        'password': 'Testing12345!',
        'portal': 'teacher'
    })
    assert res_teacher.status_code == 403
    assert res_teacher.headers.get('X-Error-Code') == 'WRONG_PORTAL'
    assert 'Teacher Portal' in res_teacher.json()['detail']['message']

    # 3. Student trying to log into admin portal -> 403 WRONG_PORTAL
    res_admin = client.post('/auth/login', json={
        'email': accounts['student'].email,
        'password': 'Testing12345!',
        'portal': 'admin'
    })
    assert res_admin.status_code == 403
    assert res_admin.headers.get('X-Error-Code') == 'WRONG_PORTAL'
    assert 'Admin Portal' in res_admin.json()['detail']['message']


def test_teacher_portal_login_matrix(client, accounts):
    # 1. Valid teacher in teacher portal -> 200
    res = client.post('/auth/login', json={
        'email': accounts['teacher'].email,
        'password': 'Testing12345!',
        'portal': 'teacher'
    })
    assert res.status_code == 200
    data = res.json()
    assert 'access_token' in data
    assert data['user']['role'] == 'teacher'

    # 2. Teacher trying to log into student portal -> 403 WRONG_PORTAL
    res_student = client.post('/auth/login', json={
        'email': accounts['teacher'].email,
        'password': 'Testing12345!',
        'portal': 'student'
    })
    assert res_student.status_code == 403
    assert res_student.headers.get('X-Error-Code') == 'WRONG_PORTAL'
    assert 'Student Portal' in res_student.json()['detail']['message']

    # 3. Teacher trying to log into admin portal -> 403 WRONG_PORTAL
    res_admin = client.post('/auth/login', json={
        'email': accounts['teacher'].email,
        'password': 'Testing12345!',
        'portal': 'admin'
    })
    assert res_admin.status_code == 403
    assert res_admin.headers.get('X-Error-Code') == 'WRONG_PORTAL'
    assert 'Admin Portal' in res_admin.json()['detail']['message']


def test_admin_portal_login_matrix(client, accounts):
    # 1. Valid admin in admin portal -> 200
    res = client.post('/auth/login', json={
        'email': accounts['admin'].email,
        'password': 'Testing12345!',
        'portal': 'admin'
    })
    assert res.status_code == 200
    data = res.json()
    assert 'access_token' in data
    assert data['user']['role'] == 'admin'

    # 2. Admin trying to log into student portal -> 403 WRONG_PORTAL
    res_student = client.post('/auth/login', json={
        'email': accounts['admin'].email,
        'password': 'Testing12345!',
        'portal': 'student'
    })
    assert res_student.status_code == 403
    assert res_student.headers.get('X-Error-Code') == 'WRONG_PORTAL'
    assert 'Student Portal' in res_student.json()['detail']['message']

    # 3. Admin trying to log into teacher portal -> 403 WRONG_PORTAL
    res_teacher = client.post('/auth/login', json={
        'email': accounts['admin'].email,
        'password': 'Testing12345!',
        'portal': 'teacher'
    })
    assert res_teacher.status_code == 403
    assert res_teacher.headers.get('X-Error-Code') == 'WRONG_PORTAL'
    assert 'Teacher Portal' in res_teacher.json()['detail']['message']


def test_wrong_credentials_with_portal_returns_invalid_credentials(client, accounts):
    # If password is wrong, returns 401 INVALID_CREDENTIALS, not 403 WRONG_PORTAL
    res = client.post('/auth/login', json={
        'email': accounts['student'].email,
        'password': 'bad-password',
        'portal': 'student'
    })
    assert res.status_code == 401
    assert res.headers.get('X-Error-Code') == 'INVALID_CREDENTIALS'


def test_database_role_truth_and_authorization_guards(client, accounts):
    # Student cannot access admin endpoints
    res = client.get('/users', headers=headers(accounts['student']))
    assert res.status_code == 403

    # Teacher cannot access admin settings modification
    res = client.put('/settings', headers=headers(accounts['teacher']), json={
        'verification_threshold': 0.8
    })
    assert res.status_code == 403

    # Admin CAN access users and settings
    res_users = client.get('/users', headers=headers(accounts['admin']))
    assert res_users.status_code == 200

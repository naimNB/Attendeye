import pytest
from conftest import headers
from test_attendance import create_session
from app.security import token
from app.routers.checkin import qr_window


def test_access_token_expiry_returns_401_with_code(client, accounts):
    sid = accounts['student'].id
    expired_token = token({'sub': str(sid)}, 'access', -1)
    resp = client.get('/auth/me', headers={'Authorization': f'Bearer {expired_token}'})
    assert resp.status_code == 401
    assert resp.headers.get('X-Error-Code') == 'ACCESS_TOKEN_EXPIRED'
    assert resp.json()['detail']['code'] == 'ACCESS_TOKEN_EXPIRED'


def test_invalid_access_token_returns_401_with_code(client):
    resp = client.get('/auth/me', headers={'Authorization': 'Bearer not.a.valid.jwt'})
    assert resp.status_code == 401
    assert resp.headers.get('X-Error-Code') == 'INVALID_ACCESS_TOKEN'
    assert resp.json()['detail']['code'] == 'INVALID_ACCESS_TOKEN'


def test_missing_auth_header_returns_401_with_code(client):
    resp = client.get('/auth/me')
    assert resp.status_code == 401
    assert resp.headers.get('X-Error-Code') == 'AUTH_REQUIRED'
    assert resp.json()['detail']['code'] == 'AUTH_REQUIRED'


def test_unavailable_account_returns_401_with_code(client):
    orphan_token = token({'sub': '999999'}, 'access', 3600)
    resp = client.get('/auth/me', headers={'Authorization': f'Bearer {orphan_token}'})
    assert resp.status_code == 401
    assert resp.headers.get('X-Error-Code') == 'ACCOUNT_UNAVAILABLE'
    assert resp.json()['detail']['code'] == 'ACCOUNT_UNAVAILABLE'


def test_invalid_login_credentials_returns_401_with_code(client):
    from app.routers.auth import _attempts
    _attempts.clear()
    resp = client.post('/auth/login', json={'email': 'student1@demo.invalid', 'password': 'wrong-password'})
    assert resp.status_code == 401
    assert resp.headers.get('X-Error-Code') == 'INVALID_CREDENTIALS'
    assert resp.json()['detail']['code'] == 'INVALID_CREDENTIALS'


def test_expired_qr_with_valid_student_login_returns_qr_expired(db, accounts, client):
    session = create_session(db, accounts)
    session.require_qr = True
    db.commit()

    # Expired QR token
    expired_qr = token({'sid': session.id, 'window': qr_window() - 2}, 'qr', -10)
    resp = client.post('/checkin/start', headers=headers(accounts['student']), json={
        'session_id': session.id,
        'qr_token': expired_qr,
        'mode': 'random'
    })
    assert resp.status_code == 401
    assert resp.headers.get('X-Error-Code') == 'QR_EXPIRED'
    assert resp.json()['detail']['code'] == 'QR_EXPIRED'

    # Student login is still completely valid
    me_resp = client.get('/auth/me', headers=headers(accounts['student']))
    assert me_resp.status_code == 200
    assert me_resp.json()['id'] == accounts['student'].id


def test_expired_ticket_with_valid_student_login_returns_ticket_expired(db, accounts, client):
    session = create_session(db, accounts)
    session.require_qr = True
    db.commit()
    sid = accounts['student'].id

    expired_ticket = token({'tid': 'fake_tid', 'cid': 'fake_cid', 'sub': str(sid), 'sid': session.id}, 'checkin_ticket', -1)
    resp = client.post(f'/checkin/{session.id}', headers=headers(accounts['student']), data={
        'ticket_token': expired_ticket,
        'challenge_token': 'fake_challenge'
    }, files=[('frames', (f'{i}.jpg', f'frame-{i}'.encode(), 'image/jpeg')) for i in range(5)])
    assert resp.status_code == 401
    assert resp.headers.get('X-Error-Code') == 'TICKET_EXPIRED'
    assert resp.json()['detail']['code'] == 'TICKET_EXPIRED'

    # Student login is still completely valid
    me_resp = client.get('/auth/me', headers=headers(accounts['student']))
    assert me_resp.status_code == 200


def test_expired_challenge_with_valid_student_login_returns_challenge_expired(db, accounts, client):
    session = create_session(db, accounts)
    session.require_qr = True
    db.commit()
    sid = accounts['student'].id

    # Valid QR token
    valid_qr = token({'sid': session.id, 'window': qr_window()}, 'qr', 30)
    # Expired challenge token
    expired_challenge = token({'cid': 'c1', 'sub': str(sid), 'sid': session.id}, 'challenge', -1)

    resp = client.post(f'/checkin/{session.id}', headers=headers(accounts['student']), data={
        'qr_token': valid_qr,
        'challenge_token': expired_challenge
    }, files=[('frames', (f'{i}.jpg', f'frame-{i}'.encode(), 'image/jpeg')) for i in range(5)])
    assert resp.status_code == 401
    assert resp.headers.get('X-Error-Code') == 'CHALLENGE_EXPIRED'
    assert resp.json()['detail']['code'] == 'CHALLENGE_EXPIRED'

    # Student login is still valid
    me_resp = client.get('/auth/me', headers=headers(accounts['student']))
    assert me_resp.status_code == 200


def test_unrelated_errors_do_not_produce_auth_failure_codes(client, accounts):
    # 403 Forbidden for role check
    resp_403 = client.get('/users', headers=headers(accounts['student']))
    assert resp_403.status_code == 403
    assert resp_403.headers.get('X-Error-Code') is None

    # 404 Not Found
    resp_404 = client.get('/sessions/999999', headers=headers(accounts['admin']))
    assert resp_404.status_code == 404
    assert resp_404.headers.get('X-Error-Code') is None

    # 422 Validation Error
    resp_422 = client.post('/auth/login', json={'email': 'invalid-json'})
    assert resp_422.status_code == 422
    assert resp_422.headers.get('X-Error-Code') is None

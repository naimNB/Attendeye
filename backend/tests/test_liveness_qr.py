import numpy as np
import pytest
from fastapi import HTTPException
from conftest import headers
from test_attendance import create_session
from app.services.face_engine import Face
from app.services.liveness import BaselineChecker, validate_motion, eye_aspect_ratio
from app.services.challenges import issue, consume
from app.routers.checkin import qr_window, verify_qr
from app.security import token
from app.models import QRRedemption


def face(yaw=0, closed=False):
    vector = np.zeros(512, dtype=np.float32); vector[0] = 1
    points = np.zeros((68, 3)); h = .04 if closed else .6
    eye = np.array([[0, 0], [1, h], [3, h], [4, 0], [3, -h], [1, -h]])
    points[36:42, :2] = eye; points[42:48, :2] = eye
    return Face(np.array([0, 0, 100, 100]), vector, points, yaw, 0., np.zeros((100, 100, 3), dtype=np.uint8), .99, [])


def test_blink_and_head_turn():
    assert validate_motion([face(), face(), face(closed=True), face(), face()], 'blink')
    assert not validate_motion([face() for _ in range(8)], 'blink')
    assert validate_motion([face(), face(10), face(30), face(10), face()], 'turn_left')
    assert not validate_motion([face(), face(10), face(30), face(10), face()], 'turn_right')
    changed = face(); changed.vector[:] = 0; changed.vector[1] = 1
    assert not validate_motion([face(), face(), changed, face(), face()], 'blink')


def test_small_crop_not_checked():
    sample = face(); sample.crop = np.zeros((20, 20, 3), dtype=np.uint8)
    result = BaselineChecker().check(sample.crop, sample)
    assert not result.passed and result.reason == 'liveness_not_checked'


def test_challenge_binding_expiry_replay(db, accounts):
    session = create_session(db, accounts)
    challenge = issue(db, accounts['student'].id, session.id)
    with pytest.raises(HTTPException): consume(db, challenge['token'], accounts['other'].id, session.id)
    consume(db, challenge['token'], accounts['student'].id, session.id)
    with pytest.raises(HTTPException): consume(db, challenge['token'], accounts['student'].id, session.id)
    expired = token({'cid': 'unused', 'sub': str(accounts['student'].id), 'sid': session.id}, 'challenge', -1)
    with pytest.raises(HTTPException): consume(db, expired, accounts['student'].id, session.id)


def test_qr_one_window():
    assert qr_window(29.99) == 0 and qr_window(30) == 1
    current = token({'sid': 1, 'window': qr_window()}, 'qr', 30)
    verify_qr(current, 1)
    with pytest.raises(HTTPException): verify_qr(current, 2)
    with pytest.raises(HTTPException): verify_qr(token({'sid': 1, 'window': qr_window()-1}, 'qr', 30), 1)


def test_duplicate_checkin_rejected_before_inference(db, accounts, client):
    session = create_session(db, accounts); session.require_qr = True
    db.add(QRRedemption(session_id=session.id, student_id=accounts['student'].id)); db.commit()
    response = client.post(f'/checkin/{session.id}', headers=headers(accounts['student']), data={
        'qr_token': token({'sid': session.id, 'window': qr_window()}, 'qr', 30), 'challenge_token': 'unused'},
        files=[('frames', (f'{i}.jpg', b'bad', 'image/jpeg')) for i in range(5)])
    assert response.status_code == 409


def test_two_factor_success_and_face_failure(db, accounts, client, monkeypatch):
    from app.routers import checkin as module
    from app.services.recognition import Observation
    from app.services.matching import Match
    from app.models import AttendanceRecord
    from sqlalchemy import select
    session = create_session(db, accounts); session.require_qr = True; db.commit()
    sid = accounts['student'].id
    monkeypatch.setattr(module, 'gallery_for', lambda db, section: {sid: [face().vector]})
    monkeypatch.setattr(module, 'validate_motion', lambda faces, prompt: True)
    def observe(data, gallery, limits):
        return Observation([face()], [Match(0, sid, .9, .8, 'auto', [])], 100, 100)
    monkeypatch.setattr(module, 'analyse', observe)
    challenge = issue(db, sid, session.id)
    response = client.post(f'/checkin/{session.id}', headers=headers(accounts['student']), data={
        'qr_token': token({'sid': session.id, 'window': qr_window()}, 'qr', 30), 'challenge_token': challenge['token']},
        files=[('frames', (f'{i}.jpg', f'unique-{i}'.encode(), 'image/jpeg')) for i in range(5)])
    assert response.status_code == 200 and response.json()['present']
    db.expire_all()
    assert db.get(QRRedemption, (session.id, sid)) is not None
    assert db.scalar(select(AttendanceRecord).where(AttendanceRecord.session_id == session.id)).status == 'present'
    other_session = create_session(db, accounts); other_session.require_qr = True; db.commit()
    monkeypatch.setattr(module, 'validate_motion', lambda faces, prompt: False)
    challenge = issue(db, sid, other_session.id)
    failed = client.post(f'/checkin/{other_session.id}', headers=headers(accounts['student']), data={
        'qr_token': token({'sid': other_session.id, 'window': qr_window()}, 'qr', 30), 'challenge_token': challenge['token']},
        files=[('frames', (f'{i}.jpg', f'unique-{i}'.encode(), 'image/jpeg')) for i in range(5)])
    assert failed.status_code == 422
    db.expire_all()
    assert db.get(QRRedemption, (other_session.id, sid)) is None

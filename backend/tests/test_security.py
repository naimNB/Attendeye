from datetime import timedelta
import io
import numpy as np
import pytest
from PIL import Image
from sqlalchemy import select
from fastapi import HTTPException
from conftest import headers
from app.models import FaceEmbedding, Consent, ReviewItem, now
from app.security import encrypt_vector, decrypt_vector, token, decode_token, hash_password, verify_password
from app.services.face_engine import decode_image
from app.services.privacy import save_thumbnail, cleanup
from app.config import settings
from test_attendance import create_session


def test_encryption_and_password():
    vector = np.ones(512, dtype=np.float32) / np.sqrt(512)
    encrypted = encrypt_vector(vector)
    assert encrypted != vector.tobytes()
    np.testing.assert_allclose(decrypt_vector(encrypted), vector)
    hashed = hash_password('Password123!')
    assert hashed != 'Password123!' and verify_password('Password123!', hashed)
    assert not verify_password('wrong', hashed)


def test_token_expiry_and_purpose():
    with pytest.raises(HTTPException): decode_token(token({'sub': '1'}, 'access', -1), 'access')
    with pytest.raises(HTTPException): decode_token(token({'sub': '1'}, 'qr', 60), 'access')


def test_roles_and_foreign_section(db, accounts, client):
    session = create_session(db, accounts)
    assert client.get('/users').status_code == 401
    assert client.get('/users', headers=headers(accounts['student'])).status_code == 403
    assert client.get(f'/sessions/{session.id}/records', headers=headers(accounts['outsider'])).status_code == 403
    assert client.get(f'/sessions/{session.id}/records', headers=headers(accounts['student'])).status_code == 403
    assert client.get('/auth/me', headers=headers(accounts['student'])).json().get('password_hash') is None


def test_consent_required_and_revoke(db, accounts, client):
    user = accounts['student']; auth = headers(user)
    result = client.post('/enrol/sample', headers=auth, data={'pose': 'front'}, files={'image': ('x.jpg', b'bad', 'image/jpeg')})
    assert result.status_code == 409
    assert client.post('/enrol/consent', headers=auth, json={'accepted': False}).status_code == 422
    assert client.post('/enrol/consent', headers=auth, json={'accepted': True}).status_code == 200
    db.add(FaceEmbedding(student_id=user.id, vector_encrypted=encrypt_vector(np.ones(512, dtype=np.float32)), pose_label='front')); db.commit()
    assert 'vector_encrypted' not in client.get('/enrol/status', headers=auth).text
    assert client.delete('/enrol/me', headers=auth).status_code == 200
    db.expire_all()
    assert not list(db.scalars(select(FaceEmbedding)))
    assert db.scalar(select(Consent)).revoked_at is not None


def test_thumbnail_expiry_and_authorization(db, accounts, client):
    session = create_session(db, accounts)
    filename = save_thumbnail(np.zeros((100, 100, 3), dtype=np.uint8))
    item = ReviewItem(session_id=session.id, thumbnail_path=filename, reason='unknown', created_at=now()-timedelta(hours=25))
    db.add(item); db.commit()
    assert client.get(f'/review/{item.id}/thumbnail', headers=headers(accounts['outsider'])).status_code == 403
    assert client.get(f'/review/{item.id}/thumbnail', headers=headers(accounts['student'])).status_code == 403
    cleanup(db); db.commit()
    assert not (settings.private_dir / filename).exists()
    assert client.get(f'/review/{item.id}/thumbnail', headers=headers(accounts['teacher'])).status_code == 404


def test_upload_types_and_image_size():
    with pytest.raises(ValueError): decode_image(b'not an image')
    with pytest.raises(ValueError): decode_image(b'a' * (settings.max_upload + 1))
    buffer = io.BytesIO(); Image.new('RGB', (10, 10)).save(buffer, format='GIF')
    with pytest.raises(ValueError): decode_image(buffer.getvalue())


def test_no_mutable_audit_routes_and_cors(client, accounts):
    assert client.delete('/audit/1', headers=headers(accounts['admin'])).status_code == 404
    response = client.options('/auth/login', headers={'Origin': 'https://untrusted.invalid', 'Access-Control-Request-Method': 'POST'})
    assert 'access-control-allow-origin' not in response.headers


def test_rate_limit():
    from app.routers.auth import rate_limit, _attempts
    _attempts.clear()
    for _ in range(10): rate_limit('test-ip')
    with pytest.raises(HTTPException) as error: rate_limit('test-ip')
    assert error.value.status_code == 429
    _attempts.clear()


def test_capture_window_and_debug(db, accounts, client):
    row = create_session(db, accounts); row.ends_at = now()-timedelta(seconds=1); db.commit()
    response = client.post(f'/sessions/{row.id}/capture-photo', headers=headers(accounts['teacher']),
                           data={'volunteers_confirmed': 'true'}, files={'image': ('x.jpg', b'bad', 'image/jpeg')})
    assert response.status_code == 409

from datetime import timedelta
from sqlalchemy import select
from conftest import headers
from app.models import ClassSession, AttendanceRecord, AuditLog, Notification, now
from app.services.attendance import percentage, section_percentage, set_record


def create_session(db, accounts, closed=False):
    row = ClassSession(section_id=accounts['section'].id, teacher_id=accounts['teacher'].id,
                       starts_at=now()-timedelta(minutes=5), ends_at=now()+timedelta(minutes=5),
                       status='closed' if closed else 'open')
    db.add(row); db.commit(); return row


def test_percentage_zero_denominator():
    assert percentage(0, 0) is None
    assert percentage(3, 4) == 75


def test_closed_sessions_only_and_correction(db, accounts, client):
    first = create_session(db, accounts, True); second = create_session(db, accounts, True)
    opened = create_session(db, accounts)
    student = accounts['student']
    set_record(db, first.id, student.id); set_record(db, opened.id, student.id)
    missing = set_record(db, second.id, student.id, 'absent'); db.commit()
    assert section_percentage(db, student.id, accounts['section'].id)['percentage'] == 50
    response = client.put(f'/attendance/{missing.id}', headers=headers(accounts['teacher']), json={'status': 'present', 'reason': 'Verified classroom presence'})
    assert response.status_code == 200
    db.expire_all()
    assert section_percentage(db, student.id, accounts['section'].id)['percentage'] == 100
    assert db.scalar(select(AuditLog).where(AuditLog.record_id == missing.id)).reason == 'Verified classroom presence'


def test_close_absence_and_alert(db, accounts, client):
    session = create_session(db, accounts)
    response = client.post(f'/sessions/{session.id}/close', headers=headers(accounts['teacher']))
    assert response.status_code == 200
    db.expire_all()
    records = list(db.scalars(select(AttendanceRecord).where(AttendanceRecord.session_id == session.id)))
    assert len(records) == 2 and all(r.status == 'absent' for r in records)
    assert db.scalar(select(Notification).where(Notification.user_id == accounts['student'].id)) is not None
    client.post(f'/sessions/{session.id}/close', headers=headers(accounts['teacher']))
    db.expire_all()
    assert len(list(db.scalars(select(AttendanceRecord)))) == 2


def test_auto_cannot_overwrite_manual(db, accounts):
    session = create_session(db, accounts)
    set_record(db, session.id, accounts['student'].id, 'absent', source='manual', actor_id=accounts['teacher'].id, reason='Verified absent')
    set_record(db, session.id, accounts['student'].id, 'present', source='auto')
    db.flush()
    assert db.scalar(select(AttendanceRecord)).status == 'absent'

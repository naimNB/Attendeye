import hashlib
import time
from fastapi import APIRouter, HTTPException, File, Form, UploadFile
from sqlalchemy import select
from ..deps import DB, Teacher, Student, Current, session_access
from ..models import QRRedemption, AttendanceRecord
from ..schemas import ChallengeIn
from ..security import token, decode_token
from ..services.challenges import issue, consume
from ..services.uploads import read_image
from ..services.recognition import analyse, gallery_for
from ..services.liveness import validate_motion
from ..services.matching import fuse_frames
from ..services.attendance import get_settings, set_record
from ..services.locks import mutation_lock, processing_slots

router = APIRouter(tags=["check-in", "liveness"])


def qr_window(stamp: float | None = None) -> int:
    return int((time.time() if stamp is None else stamp) // 30)


def verify_qr(signed: str, session_id: int) -> None:
    data = decode_token(signed, "qr")
    if data.get("sid") != session_id or data.get("window") != qr_window():
        raise HTTPException(401, "QR code expired or belongs to another session")


@router.get("/sessions/{session_id}/qr")
def qr(session_id: int, db: DB, teacher: Teacher) -> dict:
    row = session_access(db, teacher, session_id, capture=True)
    if not row.require_qr: raise HTTPException(409, "QR is disabled for this session")
    stamp = time.time()
    remaining = max(1, 30 - int(stamp % 30))
    return {"token": token({"sid": session_id, "window": qr_window(stamp)}, "qr", remaining),
            "expires_in": remaining, "session_id": session_id}


@router.post("/liveness/challenge")
def challenge(body: ChallengeIn, db: DB, user: Current) -> dict:
    session_access(db, user, body.session_id, capture=True)
    return issue(db, user.id, body.session_id, body.mode)


@router.post("/liveness/blink-challenge")
def blink(body: ChallengeIn, db: DB, user: Current) -> dict:
    session_access(db, user, body.session_id, capture=True)
    return issue(db, user.id, body.session_id, "blink")


@router.post("/liveness/verify")
def verify(db: DB, user: Current, session_id: int = Form(...), challenge_token: str = Form(...),
           frames: list[UploadFile] = File(...)) -> dict:
    if not 5 <= len(frames) <= 8: raise HTTPException(422, "Supply 5..8 frames")
    from ..services.face_engine import decode_image, get_face_engine
    with mutation_lock:
        session_access(db, user, session_id, capture=True)
        prompt = consume(db, challenge_token, user.id, session_id)
        blobs = [read_image(f) for f in frames]
        if len({hashlib.sha256(b).digest() for b in blobs}) != len(blobs):
            raise HTTPException(422, "Duplicate frames")
        batches = [get_face_engine().detect(decode_image(b)) for b in blobs]
        passed = all(len(b) == 1 for b in batches) and validate_motion([b[0] for b in batches], prompt)
    return {"passed": passed, "prompt": prompt}


@router.post("/checkin/{session_id}")
def checkin(session_id: int, db: DB, student: Student, qr_token: str = Form(...),
            challenge_token: str = Form(...), frames: list[UploadFile] = File(...)) -> dict:
    if not 5 <= len(frames) <= 8: raise HTTPException(422, "Supply 5..8 frames")
    if not processing_slots.acquire(blocking=False): raise HTTPException(429, "Recognition is busy")
    try:
        with mutation_lock:
            row = session_access(db, student, session_id, capture=True)
            if not row.require_qr: raise HTTPException(409, "This session does not use QR check-in")
            verify_qr(qr_token, session_id)
            if db.get(QRRedemption, (session_id, student.id)):
                raise HTTPException(409, "Already checked in")
            existing = db.scalar(select(AttendanceRecord).where(AttendanceRecord.session_id == session_id,
                                  AttendanceRecord.student_id == student.id))
            if existing is not None:
                raise HTTPException(409, "Attendance record exists; contact the teacher")
            prompt = consume(db, challenge_token, student.id, session_id)
            blobs = [read_image(f) for f in frames]
            if len({hashlib.sha256(b).digest() for b in blobs}) != len(blobs):
                raise HTTPException(422, "Duplicate frames")
            gallery = gallery_for(db, row.section_id)
            if student.id not in gallery: raise HTTPException(409, "Complete face enrolment first")
            observations = [analyse(b, gallery, get_settings(db)) for b in blobs]
            if not all(len(o.faces) == 1 for o in observations):
                raise HTTPException(422, "Exactly one face is required in every frame")
            if not validate_motion([o.faces[0] for o in observations], prompt):
                raise HTTPException(422, "Active liveness challenge failed")
            # Every frame must identify the logged-in student; never match only against themselves.
            if any(o.matches[0].student_id != student.id for o in observations):
                raise HTTPException(422, "Face identity is inconsistent")
            votes = fuse_frames([o.matches for o in observations])
            if student.id not in votes:
                raise HTTPException(422, "Face or passive liveness verification failed")
            db.add(QRRedemption(session_id=session_id, student_id=student.id))
            set_record(db, session_id, student.id, confidence=votes[student.id]["confidence"])
            db.commit()
            return {"present": True}
    finally:
        processing_slots.release()

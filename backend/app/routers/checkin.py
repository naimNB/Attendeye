import hashlib
import secrets
import time
from datetime import timedelta
from fastapi import APIRouter, HTTPException, File, Form, UploadFile
from sqlalchemy import select, update
from ..deps import DB, Teacher, Student, Current, session_access
from ..models import QRRedemption, AttendanceRecord, CheckinTicket, now
from ..schemas import ChallengeIn, CheckinStartIn
from ..security import token, decode_token, auth_error
from ..services.challenges import issue, consume
from ..services.uploads import read_image
from ..services.recognition import analyse, gallery_for
from ..services.liveness import validate_motion, get_liveness_status
from ..services.matching import fuse_frames
from ..services.attendance import get_settings, set_record
from ..services.locks import mutation_lock, processing_slots

router = APIRouter(tags=["check-in", "liveness"])


def qr_window(stamp: float | None = None) -> int:
    return int((time.time() if stamp is None else stamp) // 30)


def verify_qr(signed: str, session_id: int) -> None:
    data = decode_token(signed, "qr")
    if data.get("sid") != session_id or data.get("window") != qr_window():
        raise auth_error(401, "QR_EXPIRED", "QR code expired or belongs to another session")


@router.get("/liveness/status")
def liveness_status(user: Current) -> dict:
    return get_liveness_status()


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


@router.post("/checkin/start")
def checkin_start(body: CheckinStartIn, db: DB, student: Student) -> dict:
    with mutation_lock:
        row = session_access(db, student, body.session_id, capture=True)
        if not row.require_qr:
            raise HTTPException(409, "This session does not use QR check-in")
        verify_qr(body.qr_token, body.session_id)
        if db.get(QRRedemption, (body.session_id, student.id)):
            raise HTTPException(409, "Already checked in")
        existing = db.scalar(select(AttendanceRecord).where(
            AttendanceRecord.session_id == body.session_id,
            AttendanceRecord.student_id == student.id))
        if existing is not None:
            raise HTTPException(409, "Attendance record exists; contact the teacher")
        gallery = gallery_for(db, row.section_id)
        if student.id not in gallery:
            raise HTTPException(409, "Complete face enrolment first")

        # Issue one-time challenge (15s) and bound ticket (15s)
        challenge_data = issue(db, student.id, body.session_id, body.mode)
        chal_info = decode_token(challenge_data["token"], "challenge")
        ticket_id = secrets.token_hex(24)
        expires = now() + timedelta(seconds=15)
        ticket_row = CheckinTicket(
            id=ticket_id,
            session_id=body.session_id,
            student_id=student.id,
            challenge_id=chal_info["cid"],
            expires_at=expires,
            used=False
        )
        db.add(ticket_row)
        db.commit()

        signed_ticket = token({
            "tid": ticket_id,
            "cid": chal_info["cid"],
            "sub": str(student.id),
            "sid": body.session_id
        }, "checkin_ticket", 15)

    return {
        "ticket_token": signed_ticket,
        "challenge_token": challenge_data["token"],
        "prompt": challenge_data["prompt"],
        "instructions": challenge_data["instructions"],
        "expires_in": 15
    }


@router.post("/checkin/{session_id}")
def checkin(session_id: int, db: DB, student: Student,
            ticket_token: str | None = Form(None),
            qr_token: str | None = Form(None),
            challenge_token: str = Form(...),
            frames: list[UploadFile] = File(...)) -> dict:
    if not 5 <= len(frames) <= 8: raise HTTPException(422, "Supply 5..8 frames")
    if not processing_slots.acquire(blocking=False): raise HTTPException(429, "Recognition is busy")
    try:
        with mutation_lock:
            row = session_access(db, student, session_id, capture=True)
            if not row.require_qr: raise HTTPException(409, "This session does not use QR check-in")
            if ticket_token:
                t_data = decode_token(ticket_token, "checkin_ticket")
                if t_data.get("sub") != str(student.id) or t_data.get("sid") != session_id:
                    raise HTTPException(403, "Ticket is bound to another student or session")
                t_res = db.execute(update(CheckinTicket).where(
                    CheckinTicket.id == t_data.get("tid"),
                    CheckinTicket.student_id == student.id,
                    CheckinTicket.session_id == session_id,
                    CheckinTicket.used.is_(False),
                    CheckinTicket.expires_at > now()
                ).values(used=True))
                if t_res.rowcount != 1:
                    raise HTTPException(409, "Check-in ticket expired or already used. Scan QR to start fresh.")
            elif qr_token:
                verify_qr(qr_token, session_id)
            else:
                raise HTTPException(422, "Supply ticket_token or qr_token")

            if db.get(QRRedemption, (session_id, student.id)):
                raise HTTPException(409, "Already checked in")
            existing = db.scalar(select(AttendanceRecord).where(AttendanceRecord.session_id == session_id,
                                  AttendanceRecord.student_id == student.id))
            if existing is not None:
                raise HTTPException(409, "Attendance record exists; contact the teacher")
            # Consume challenge atomically
            prompt = consume(db, challenge_token, student.id, session_id)
            gallery = gallery_for(db, row.section_id)
            if student.id not in gallery: raise HTTPException(409, "Complete face enrolment first")

        blobs = [read_image(f) for f in frames]
        if len({hashlib.sha256(b).digest() for b in blobs}) != len(blobs):
            raise HTTPException(422, "Duplicate frames")
        observations = [analyse(b, gallery, get_settings(db)) for b in blobs]
        if not all(len(o.faces) == 1 for o in observations):
            raise HTTPException(422, "Exactly one face is required in every frame")
        # Validate ordered motion on faces
        detected_faces = [o.faces[0] for o in observations]
        if not validate_motion(detected_faces, prompt):
            raise HTTPException(422, "Active liveness challenge failed")
        # Identity continuity: all faces must match student.id without identity swaps
        ref_vec = detected_faces[0].vector
        if any(float(ref_vec @ f.vector) < .40 for f in detected_faces[1:]):
            raise HTTPException(422, "Face identity is inconsistent across frames")
        for o in observations:
            assoc_id = o.matches[0].student_id or o.matches[0].candidate_id
            if assoc_id != student.id:
                raise HTTPException(422, "Face identity is inconsistent")
        votes = fuse_frames([o.matches for o in observations])
        if student.id not in votes:
            raise HTTPException(422, "Face or passive liveness verification failed")

        with mutation_lock:
            # Re-verify before final commit
            if db.get(QRRedemption, (session_id, student.id)):
                raise HTTPException(409, "Already checked in")
            db.add(QRRedemption(session_id=session_id, student_id=student.id))
            set_record(db, session_id, student.id, confidence=votes[student.id]["confidence"])
            db.commit()
        return {"present": True}
    finally:
        processing_slots.release()

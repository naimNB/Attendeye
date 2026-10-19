import hashlib
import json
import logging
import time
from dataclasses import dataclass
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import FaceEmbedding, Enrolment, Consent, ReviewItem, User, ClassSession, Setting
from ..config import settings
from ..security import decrypt_vector
from .face_engine import Face, get_face_engine, decode_image
from .liveness import get_liveness_checker, validate_motion
from .matching import Match, match_faces, fuse_frames
from .attendance import get_settings, set_record
from .privacy import save_thumbnail

log = logging.getLogger(__name__)


def gallery_for(db: Session, section_id: int) -> dict[int, list[np.ndarray]]:
    model_setting = db.get(Setting, "embedding_model")
    if model_setting is not None and model_setting.value != settings.face_model:
        raise ValueError("Face model changed. Restore the original model or delete and re-enrol all biometrics.")
    enrolled = set(db.scalars(select(Enrolment.student_id).where(Enrolment.section_id == section_id)))
    consented = set(db.scalars(select(Consent.student_id).where(Consent.revoked_at.is_(None))))
    gallery, poses = {}, {}
    for row in db.scalars(select(FaceEmbedding).where(FaceEmbedding.student_id.in_(enrolled & consented))):
        gallery.setdefault(row.student_id, []).append(decrypt_vector(row.vector_encrypted))
        poses.setdefault(row.student_id, set()).add(row.pose_label)
    return {sid: vectors for sid, vectors in gallery.items()
            if len(vectors) >= 5 and {"front", "left", "right", "up", "down"}.issubset(poses[sid])}


@dataclass
class Observation:
    faces: list[Face]
    matches: list[Match]
    width: int
    height: int


def analyse(data: bytes, gallery: dict, limits: dict) -> Observation:
    image = decode_image(data)
    faces = get_face_engine().detect(image)
    checks = [get_liveness_checker().check(image, face) for face in faces]
    matches = match_faces([f.vector for f in faces], gallery, limits["t_low"], limits["t_high"],
                          limits["margin"], [c.passed for c in checks], [not f.quality_reasons for f in faces])
    for match, face, check in zip(matches, faces, checks):
        if face.quality_reasons:
            match.reason = ",".join(face.quality_reasons)
        elif not check.passed:
            match.reason = check.reason
    return Observation(faces, matches, image.shape[1], image.shape[0])


def capture(db: Session, session: ClassSession, images: list[bytes], prompt: str | None = None,
            debug: bool = False) -> dict:
    started = time.perf_counter()
    if len(images) > 1 and len({hashlib.sha256(data).digest() for data in images}) != len(images):
        raise ValueError("Duplicate frames cannot count as independent votes")
    gallery = gallery_for(db, session.section_id)
    limits = get_settings(db)
    observations = [analyse(data, gallery, limits) for data in images]
    if prompt is not None:
        tracks = {}
        for observation in observations:
            for face, match in zip(observation.faces, observation.matches):
                if match.student_id is not None:
                    tracks.setdefault(match.student_id, []).append(face)
        passing = {sid for sid, faces in tracks.items() if len(faces) == len(images) and validate_motion(faces, prompt)}
        for observation in observations:
            for match in observation.matches:
                if match.reason == "auto" and match.student_id not in passing:
                    match.reason = "active_challenge_fail"
    if session.require_qr:
        for observation in observations:
            for match in observation.matches:
                if match.reason == "auto": match.reason = "qr_required"
    if len(images) > 1:
        accepted = fuse_frames([o.matches for o in observations])
    else:
        accepted = {m.student_id: {"confidence": m.score, "votes": 1}
                    for m in observations[0].matches if m.reason == "auto"}
    for student_id, value in accepted.items():
        set_record(db, session.id, student_id, confidence=value["confidence"])
    reviews, boxes, seen = [], [], set()
    names = {sid: db.get(User, sid).name for sid in gallery}
    for frame_index, observation in enumerate(observations):
        for face, match in zip(observation.faces, observation.matches):
            reason = match.reason
            if match.reason == "auto" and match.student_id not in accepted:
                reason = "insufficient_votes"
            box = {"frame": frame_index, "box": face.box.tolist(), "decision": reason,
                   "student_id": match.student_id if reason == "auto" else None,
                   "width": observation.width, "height": observation.height}
            if debug:
                box.update(score=match.score, margin=match.margin)
            boxes.append(box)
            if reason != "auto":
                # Identity-associated reviews are consolidated across a burst.
                key = (match.student_id, reason) if match.student_id is not None else (frame_index, match.face_index)
                if key in seen: continue
                seen.add(key)
                candidates = [{**c, "name": names.get(c["student_id"], "Student")} for c in match.candidates]
                item = ReviewItem(session_id=session.id, thumbnail_path=save_thumbnail(face.crop),
                                  candidates_json=json.dumps(candidates), reason=reason)
                db.add(item); db.flush(); reviews.append(item.id)
    db.commit()
    elapsed = round((time.perf_counter() - started) * 1000, 1)
    log.info("Capture complete: frames=%d elapsed_ms=%.1f", len(images), elapsed)
    return {"accepted": [{"student_id": sid, "name": names[sid], **value} for sid, value in accepted.items()],
            "review_ids": reviews, "boxes": boxes, "elapsed_ms": elapsed,
            "debug": debug, "faces_detected": sum(len(o.faces) for o in observations)}

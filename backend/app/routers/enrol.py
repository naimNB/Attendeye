from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from sqlalchemy import select
from ..deps import DB, Student
from ..models import Consent, FaceEmbedding, Setting
from ..config import settings
from ..schemas import ConsentIn
from ..security import encrypt_vector
from ..services.face_engine import decode_image, get_face_engine
from ..services.uploads import read_image
from ..services.privacy import revoke_biometrics
from ..services.locks import mutation_lock

router = APIRouter(prefix="/enrol", tags=["enrolment"])
POSES = {"front", "left", "right", "up", "down"}
CONSENT_TEXT = ("I voluntarily consent to encrypted face embeddings being used for the PUB AttendEye "
                "academic attendance verification system. Raw enrolment photos are not saved. Temporary "
                "encrypted review crops may be retained for up to 24 hours. I can withdraw and delete "
                "my biometric data at any time; a manual attendance alternative is available.")


def active_consent(db: DB, uid: int) -> Consent | None:
    return db.scalar(select(Consent).where(Consent.student_id == uid, Consent.revoked_at.is_(None)))


@router.post("/consent")
def consent(body: ConsentIn, db: DB, student: Student) -> dict:
    with mutation_lock:
        row = active_consent(db, student.id)
        if row is None:
            row = Consent(student_id=student.id, text_version=body.text_version)
            db.add(row); db.commit()
    return {"granted_at": row.granted_at.isoformat() + "Z", "text_version": row.text_version}


@router.get("/status")
def status(db: DB, student: Student) -> dict:
    rows = list(db.scalars(select(FaceEmbedding).where(FaceEmbedding.student_id == student.id)))
    row = active_consent(db, student.id)
    complete = len(rows) >= 5 and POSES.issubset({e.pose_label for e in rows})
    return {"consented": row is not None, "count": len(rows), "poses": [r.pose_label for r in rows],
            "complete": complete, "consent_text": CONSENT_TEXT, "text_version": "1.0"}


@router.post("/sample")
def sample(db: DB, student: Student, image: UploadFile = File(...), pose: str = Form(...)) -> dict:
    if pose not in POSES:
        raise HTTPException(422, "Pose must be front, left, right, up or down")
    if not active_consent(db, student.id):
        raise HTTPException(409, "Explicit consent is required first")

    # Perform image decoding and neural detection outside global mutation lock
    frame = decode_image(read_image(image))
    faces = get_face_engine().detect(frame)
    if len(faces) != 1:
        raise HTTPException(422, "Exactly one face is required")
    face = faces[0]
    if face.quality_reasons:
        raise HTTPException(422, ", ".join(face.quality_reasons))

    # Signed orientation gates:
    # Yaw: positive = turn left, negative = turn right (matches validate_motion)
    # Pitch: negative = tilt up, positive = tilt down
    if pose == "front" and (abs(face.yaw) > 15 or abs(face.pitch) > 15):
        raise HTTPException(422, "Look straight at the camera")
    if pose == "left" and face.yaw < 10:
        raise HTTPException(422, "Turn your head to the left")
    if pose == "right" and face.yaw > -10:
        raise HTTPException(422, "Turn your head to the right")
    if pose == "up" and face.pitch > -8:
        raise HTTPException(422, "Tilt your head slightly upwards")
    if pose == "down" and face.pitch < 8:
        raise HTTPException(422, "Tilt your head slightly downwards")

    with mutation_lock:
        if not active_consent(db, student.id):
            raise HTTPException(409, "Explicit consent is required first")
        rows = list(db.scalars(select(FaceEmbedding).where(FaceEmbedding.student_id == student.id)))
        if len(rows) >= 10:
            raise HTTPException(409, "Maximum 10 samples. Delete biometric data to restart.")
        model_setting = db.get(Setting, "embedding_model")
        if model_setting is not None and model_setting.value != settings.face_model:
            if db.scalar(select(FaceEmbedding.id).limit(1)):
                raise HTTPException(409, "Face model changed; all existing biometrics must be deleted before re-enrolment")
            model_setting.value = settings.face_model
        elif model_setting is None:
            db.add(Setting(key="embedding_model", value=settings.face_model))
        from ..security import decrypt_vector
        if rows and max(float(face.vector @ decrypt_vector(r.vector_encrypted)) for r in rows) < .35:
            raise HTTPException(422, "Sample does not match earlier samples; retry with better light")
        db.add(FaceEmbedding(student_id=student.id, vector_encrypted=encrypt_vector(face.vector), pose_label=pose))
        db.commit()
        return status(db, student)


@router.delete("/me")
def delete_me(db: DB, student: Student) -> dict:
    with mutation_lock:
        revoke_biometrics(db, student.id); db.commit()
    return {"deleted": True, "consent_revoked": True}

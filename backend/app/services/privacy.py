from datetime import timedelta
from pathlib import Path
import secrets
import cv2
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from ..config import settings
from ..models import ReviewItem, FaceEmbedding, Consent, now
from ..security import cipher


def save_thumbnail(crop: object) -> str:
    settings.private_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    ok, data = cv2.imencode(".jpg", cv2.resize(crop, (96, 96)), [cv2.IMWRITE_JPEG_QUALITY, 70])
    if not ok:
        raise ValueError("Thumbnail encoding failed")
    filename = secrets.token_hex(24) + ".enc"
    path = settings.private_dir / filename
    path.write_bytes(cipher().encrypt(data.tobytes()))
    path.chmod(0o600)
    return filename


def remove_thumbnail(item: ReviewItem) -> None:
    if item.thumbnail_path:
        (settings.private_dir / Path(item.thumbnail_path).name).unlink(missing_ok=True)
        item.thumbnail_path = None


def cleanup(db: Session) -> int:
    cutoff = now() - timedelta(hours=24)
    count = 0
    for item in db.scalars(select(ReviewItem).where(ReviewItem.thumbnail_path.is_not(None))):
        if item.created_at <= cutoff or item.status == "resolved":
            remove_thumbnail(item)
            count += 1
    # Covers orphan files left by a rolled-back transaction or interrupted request.
    if settings.private_dir.exists():
        import time
        for path in settings.private_dir.glob("*.enc"):
            if path.stat().st_mtime < time.time() - 86400:
                path.unlink(missing_ok=True)
    return count


def revoke_biometrics(db: Session, student_id: int) -> None:
    db.execute(delete(FaceEmbedding).where(FaceEmbedding.student_id == student_id))
    for consent in db.scalars(select(Consent).where(Consent.student_id == student_id, Consent.revoked_at.is_(None))):
        consent.revoked_at = now()
    # Unknown/incorrect candidate identities cannot safely identify a thumbnail's subject.
    # Conservatively purge ALL temporary review images and candidate suggestions on withdrawal.
    for item in db.scalars(select(ReviewItem)):
        remove_thumbnail(item)
        item.candidates_json = "[]"

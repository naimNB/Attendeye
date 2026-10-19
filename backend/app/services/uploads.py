from fastapi import UploadFile, HTTPException
from ..config import settings


def read_image(file: UploadFile) -> bytes:
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Only JPEG, PNG and WEBP uploads are allowed")
    data = file.file.read(settings.max_upload + 1)
    if len(data) > settings.max_upload:
        raise HTTPException(413, "Image exceeds size limit")
    return data

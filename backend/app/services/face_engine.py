"""CPU InsightFace adapter. Raw images are held in memory only."""
import io
import logging
import threading
import time
from dataclasses import dataclass
from functools import lru_cache
import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from ..config import settings
from .matching import normalize

log = logging.getLogger(__name__)


@dataclass
class Face:
    box: np.ndarray
    vector: np.ndarray
    landmarks: np.ndarray | None
    yaw: float
    pitch: float
    crop: np.ndarray
    detection_score: float
    quality_reasons: list[str]


def decode_image(data: bytes) -> np.ndarray:
    if not data or len(data) > settings.max_upload:
        raise ValueError("Empty image or upload exceeds the per-image limit")
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Only JPEG, PNG and WEBP images are allowed")
            if source.width * source.height > settings.max_pixels:
                raise ValueError("Image exceeds pixel limit")
            rgb = ImageOps.exif_transpose(source).convert("RGB")
            return cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2BGR)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("Invalid image") from exc


def nms(boxes: list[np.ndarray], scores: list[float], threshold: float = .4) -> list[int]:
    if not boxes:
        return []
    array = np.asarray(boxes)
    order = np.argsort(scores)[::-1]
    keep = []
    while len(order):
        i = int(order[0])
        keep.append(i)
        rest = order[1:]
        if not len(rest):
            break
        lo = np.maximum(array[i, :2], array[rest, :2])
        hi = np.minimum(array[i, 2:], array[rest, 2:])
        intersection = np.prod(np.maximum(0, hi - lo), axis=1)
        areas = np.prod(array[:, 2:] - array[:, :2], axis=1)
        iou = intersection / np.maximum(areas[i] + areas[rest] - intersection, 1e-8)
        order = rest[iou <= threshold]
    return keep


class FaceEngine:
    def __init__(self) -> None:
        from insightface.app import FaceAnalysis
        self.lock = threading.RLock()
        self.model = FaceAnalysis(name=settings.face_model, root=settings.model_root,
                                  providers=["CPUExecutionProvider"],
                                  allowed_modules=["detection", "recognition", "landmark_3d_68"])
        self.model.prepare(ctx_id=-1, det_size=(settings.det_size, settings.det_size))
        log.info("Face engine loaded: %s, CPU", settings.face_model)

    def detect(self, image: np.ndarray) -> list[Face]:
        started = time.perf_counter()
        height, width = image.shape[:2]
        detections = []
        with self.lock:
            def scan(patch: np.ndarray, x: int = 0, y: int = 0, scale: float = 1.) -> None:
                for face in self.model.get(patch):
                    box = np.asarray(face.bbox, dtype=float) / scale + [x, y, x, y]
                    landmarks = face.get("landmark_3d_68")
                    if landmarks is not None:
                        landmarks = np.asarray(landmarks, dtype=float).copy()
                        landmarks[:, :2] = landmarks[:, :2] / scale + [x, y]
                    detections.append((face, box, landmarks))
            scan(image)
            if settings.tiled and max(height, width) > settings.tile_size:
                step = max(1, int(settings.tile_size * (1 - settings.tile_overlap)))
                ys = sorted(set(list(range(0, max(1, height - settings.tile_size), step)) + [max(0, height - settings.tile_size)]))
                xs = sorted(set(list(range(0, max(1, width - settings.tile_size), step)) + [max(0, width - settings.tile_size)]))
                for y in ys:
                    for x in xs:
                        scan(image[y:y + settings.tile_size, x:x + settings.tile_size], x, y)
            # Only run expensive 2x upscale pass if no faces were detected at native scale
            if settings.upscale and not detections:
                tile = settings.tile_size
                step = max(1, int(tile * (1 - settings.tile_overlap)))
                for y in range(0, height, step):
                    for x in range(0, width, step):
                        patch = image[y:y + tile, x:x + tile]
                        if patch.size > 0:
                            scan(cv2.resize(patch, None, fx=2, fy=2), x, y, 2.)
        t_detect = (time.perf_counter() - started) * 1000
        keep = nms([d[1] for d in detections], [float(d[0].det_score) for d in detections])
        results = []
        for index in keep:
            raw, box, landmarks = detections[index]
            box[[0, 2]] = np.clip(box[[0, 2]], 0, width)
            box[[1, 3]] = np.clip(box[[1, 3]], 0, height)
            x1, y1, x2, y2 = box.astype(int)
            crop = image[y1:y2, x1:x2].copy()
            if crop.size == 0:
                continue
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            pose = raw.get("pose")
            pitch, yaw = (float(pose[0]), float(pose[1])) if pose is not None else (0., 0.)
            reasons = []
            if min(x2 - x1, y2 - y1) < settings.min_face_size:
                reasons.append("face_too_small")
            if cv2.Laplacian(gray, cv2.CV_64F).var() < settings.min_blur:
                reasons.append("blurry")
            if gray.mean() < settings.min_brightness:
                reasons.append("too_dark")
            if pose is None:
                reasons.append("pose_unavailable")
            elif max(abs(pitch), abs(yaw)) > settings.max_pose:
                reasons.append("extreme_pose")
            results.append(Face(box, normalize(raw.embedding), landmarks, yaw, pitch,
                                crop, float(raw.det_score), reasons))
        total_ms = (time.perf_counter() - started) * 1000
        log.info("FaceEngine: detection_ms=%.1f total_ms=%.1f candidates=%d kept_faces=%d",
                 t_detect, total_ms, len(detections), len(results))
        return results


@lru_cache
def get_face_engine() -> FaceEngine:
    return FaceEngine()

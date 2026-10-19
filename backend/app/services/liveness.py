"""Stable LivenessChecker.check(image, face) interface with replaceable implementations."""
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Protocol
import logging
import cv2
import numpy as np
from ..config import settings
from .face_engine import Face

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class LivenessResult:
    passed: bool
    score: float
    reason: str
    backend: str


class LivenessChecker(Protocol):
    def check(self, image: np.ndarray, face: Face) -> LivenessResult:
        """Return a conservative passive decision for this face."""
        raise NotImplementedError("Provide a passive liveness implementation")


class BaselineChecker:
    """Uncalibrated texture/moire heuristic, never advertised as a security model."""
    def check(self, image: np.ndarray, face: Face) -> LivenessResult:
        if min(face.crop.shape[:2]) < settings.passive_min_size:
            return LivenessResult(False, 0., "liveness_not_checked", "baseline")
        gray = cv2.resize(cv2.cvtColor(face.crop, cv2.COLOR_BGR2GRAY), (80, 80)).astype(float)
        texture = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        spectrum = np.abs(np.fft.fftshift(np.fft.fft2(gray - gray.mean())))
        spectrum[35:45, 35:45] = 0
        peak = float(spectrum.max() / max(spectrum.sum(), 1))
        score = float(np.clip(min(texture / 150., 1.) * (1. - min(peak * 20, 1)), 0, 1))
        passed = score >= .5 and settings.baseline_auto
        reason = "live" if passed else ("baseline_unverified" if score >= .5 else "liveness_fail")
        return LivenessResult(passed, score, reason, "baseline")


def expanded_crop(image: np.ndarray, box: np.ndarray, scale: float) -> np.ndarray:
    """Match Silent-Face crop contract: BGR, expanded box, clamped inside image."""
    height, width = image.shape[:2]
    x1, y1, x2, y2 = box
    bw, bh = x2 - x1, y2 - y1
    scale = min(scale, (width - 1) / max(bw, 1), (height - 1) / max(bh, 1))
    nw, nh = max(1, int(bw * scale)), max(1, int(bh * scale))
    left = int(np.clip((x1 + x2 - nw) / 2, 0, width - nw))
    top = int(np.clip((y1 + y2 - nh) / 2, 0, height - nh))
    return image[top:top + nh, left:left + nw]


class MiniFASChecker:
    def __init__(self, path: str) -> None:
        import onnxruntime as ort
        self.session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        self.input = self.session.get_inputs()[0]
        if self.input.shape[1:] != [3, 80, 80]:
            raise ValueError("Expected MiniFASNet input NCHW 3x80x80")

    def check(self, image: np.ndarray, face: Face) -> LivenessResult:
        if min(face.crop.shape[:2]) < settings.passive_min_size:
            return LivenessResult(False, 0., "liveness_not_checked", "minifasnet")
        patch = expanded_crop(image, face.box, settings.minifas_scale)
        # Official ToTensor implementation keeps BGR float values in 0..255.
        tensor = cv2.resize(patch, (80, 80)).transpose(2, 0, 1)[None].astype(np.float32)
        logits = np.asarray(self.session.run(None, {self.input.name: tensor})[0]).reshape(-1)
        if logits.shape != (3,) or not np.isfinite(logits).all():
            return LivenessResult(False, 0., "liveness_fail", "minifasnet")
        probability = np.exp(logits - logits.max())
        probability /= probability.sum()
        score = float(probability[1])
        passed = int(probability.argmax()) == 1 and score >= settings.minifas_threshold
        return LivenessResult(passed, score, "live" if passed else "liveness_fail", "minifasnet")


@lru_cache
def get_liveness_checker() -> LivenessChecker:
    if Path(settings.minifas_path).is_file():
        try:
            checker = MiniFASChecker(settings.minifas_path)
            log.info("Active passive-liveness backend: MiniFASNet ONNX, CPU")
            return checker
        except Exception:
            log.warning("MiniFASNet unavailable or invalid; using conservative baseline")
    else:
        log.warning("MiniFASNet missing; active backend: baseline (auto-accept=%s)", settings.baseline_auto)
    return BaselineChecker()


def eye_aspect_ratio(points: np.ndarray) -> float:
    p = np.asarray(points, dtype=float)[:, :2]
    return float((np.linalg.norm(p[1] - p[5]) + np.linalg.norm(p[2] - p[4])) /
                 max(2 * np.linalg.norm(p[0] - p[3]), 1e-6))


def validate_motion(faces: list[Face], prompt: str) -> bool:
    """Ordered open-closed-open or centre-turn-centre, on a consistent identity."""
    if len(faces) < 5 or any(f.landmarks is None for f in faces):
        return False
    reference = faces[0].vector
    if any(float(reference @ face.vector) < .4 for face in faces[1:]):
        return False
    if prompt == "blink":
        values = [float((eye_aspect_ratio(f.landmarks[36:42]) + eye_aspect_ratio(f.landmarks[42:48])) / 2) for f in faces]
        return values[0] > .20 and values[-1] > .20 and min(values[1:-1]) < min(.18, min(values[0], values[-1]) * .70)
    if prompt in {"turn_left", "turn_right"}:
        values = [f.yaw for f in faces]
        signed = values if prompt == "turn_left" else [-v for v in values]
        return abs(values[0]) < 15 and abs(values[-1]) < 15 and max(signed[1:-1]) > 23
    return False

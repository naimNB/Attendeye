"""Validated process configuration; secrets must be supplied explicitly."""
import os
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv
from cryptography.fernet import Fernet

load_dotenv()


def flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() == "true"


@dataclass(frozen=True)
class Config:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./attendeye.db")
    jwt_secret: str = os.getenv("JWT_SECRET", "")
    fernet_key: str = os.getenv("FERNET_KEY", "")
    jwt_minutes: int = int(os.getenv("JWT_MINUTES", "60"))
    cors_origins: list[str] = field(default_factory=lambda: os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","))
    allowed_hosts: list[str] = field(default_factory=lambda: os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(","))
    face_model: str = os.getenv("FACE_MODEL", "buffalo_l")
    model_root: str = os.getenv("MODEL_ROOT", "./models/insightface")
    det_size: int = int(os.getenv("DET_SIZE", "640"))
    min_face_size: int = int(os.getenv("MIN_FACE_SIZE", "60"))
    min_blur: float = float(os.getenv("MIN_BLUR", "45"))
    min_brightness: float = float(os.getenv("MIN_BRIGHTNESS", "35"))
    max_pose: float = float(os.getenv("MAX_POSE", "48"))
    tiled: bool = flag("TILED_DETECTION", True)
    tile_size: int = int(os.getenv("TILE_SIZE", "1000"))
    tile_overlap: float = float(os.getenv("TILE_OVERLAP", "0.25"))
    upscale: bool = flag("UPSCALE_SMALL_FACES", True)
    max_pixels: int = int(os.getenv("MAX_IMAGE_PIXELS", "16000000"))
    max_upload: int = int(os.getenv("MAX_UPLOAD_MB", "8")) * 1024 * 1024
    max_request: int = int(os.getenv("MAX_REQUEST_MB", "66")) * 1024 * 1024
    minifas_path: str = os.getenv("MINIFAS_PATH", "./models/minifasnet.onnx")
    minifas_threshold: float = float(os.getenv("MINIFAS_THRESHOLD", ".8"))
    minifas_scale: float = float(os.getenv("MINIFAS_SCALE", "2.7"))
    passive_min_size: int = int(os.getenv("PASSIVE_MIN_SIZE", "80"))
    baseline_auto: bool = flag("BASELINE_AUTO_ACCEPT", False)
    private_dir: Path = Path(os.getenv("PRIVATE_DIR", "./private"))
    debug: bool = flag("DEBUG_RECOGNITION", False)

    def validate(self) -> None:
        if len(self.jwt_secret) < 32 or self.jwt_secret == self.fernet_key:
            raise RuntimeError("Set distinct JWT_SECRET (32+ characters) and FERNET_KEY in .env")
        try:
            Fernet(self.fernet_key.encode())
        except (ValueError, TypeError) as exc:
            raise RuntimeError("FERNET_KEY must be a valid Fernet key; run scripts/init_env.py") from exc
        if "*" in self.allowed_hosts:
            raise RuntimeError("ALLOWED_HOSTS must not use a wildcard")
        if "*" in self.cors_origins:
            raise RuntimeError("CORS must use explicit trusted origins")
        if not 0 <= self.tile_overlap < .75 or self.tile_size < 128 or self.det_size < 128:
            raise RuntimeError("Invalid detector tile settings")
        if not 1 <= self.jwt_minutes <= 1440:
            raise RuntimeError("JWT_MINUTES must be 1..1440")


settings = Config()

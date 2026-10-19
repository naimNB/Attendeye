"""Download/load the configured InsightFace pack before an offline demonstration."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import settings
from app.services.face_engine import get_face_engine


def main() -> None:
    get_face_engine()
    print(f"Face pack ready: {settings.face_model}; cache root: {settings.model_root}")
    print("Review the pretrained weights' licence before use. Switching packs requires re-enrolment and evaluation.")


if __name__ == "__main__": main()

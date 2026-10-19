"""Measure actual CPU detection+embedding latency; writes no invented benchmark."""
import argparse
import json
import platform
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import numpy as np
from app.services.face_engine import get_face_engine, decode_image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--out", type=Path, default=Path("results/benchmark.json"))
    args = parser.parse_args()
    if not args.image.is_file(): raise SystemExit(f"Image missing: {args.image}")
    if args.runs < 1: raise SystemExit("--runs must be positive")
    image = decode_image(args.image.read_bytes())
    engine = get_face_engine(); engine.detect(image)
    elapsed = []
    for _ in range(args.runs):
        start = time.perf_counter(); faces = engine.detect(image); elapsed.append(time.perf_counter() - start)
    result = {"measurement": "warm detection+embedding only; no network, passive check or DB",
              "runs": args.runs, "mean_seconds": float(np.mean(elapsed)), "p95_seconds": float(np.percentile(elapsed, 95)),
              "width": image.shape[1], "height": image.shape[0], "faces": len(faces),
              "platform": platform.platform(), "processor": platform.processor(), "python": platform.python_version()}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__": main()

"""Fetch official MiniFASNetV2 checkpoint and export ONNX for the CPU runtime.
Optional build-only dependencies: torch and onnx. Never imported by the app.
"""
import argparse
import hashlib
import importlib.util
import json
import re
import tempfile
import urllib.request
from pathlib import Path

REPO = "minivision-ai/Silent-Face-Anti-Spoofing"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "PUB-AttendEye-model-setup"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", help="Official upstream 40-character commit; otherwise resolve current master once")
    parser.add_argument("--output", default="models/minifasnet.onnx")
    args = parser.parse_args()
    try:
        import torch
        import onnx
    except ImportError as exc:
        raise SystemExit("Export needs build-only packages: pip install torch==2.5.1 onnx==1.17.0") from exc
    revision = args.revision or json.loads(fetch(f"https://api.github.com/repos/{REPO}/commits/master"))["sha"]
    if not re.fullmatch(r"[a-fA-F0-9]{40}", revision):
        raise SystemExit("Revision must be a 40-character commit SHA")
    root = f"https://raw.githubusercontent.com/{REPO}/{revision}/"
    files = {"MiniFASNet.py": "src/model_lib/MiniFASNet.py",
             "weights.pth": "resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth",
             "LICENSE": "LICENSE"}
    manifest = {"repository": f"https://github.com/{REPO}", "revision": revision,
                "variant": "2.7_80x80_MiniFASNetV2", "input": "BGR NCHW float32 0..255", "live_class": 1,
                "crop_scale": 2.7, "sha256": {}}
    destination = Path(args.output)
    if destination.exists(): raise SystemExit("Output already exists; move it before replacing the model")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        folder = Path(temp)
        for name, path in files.items():
            data = fetch(root + path)
            (folder / name).write_bytes(data)
            manifest["sha256"][name] = hashlib.sha256(data).hexdigest()
        # Explicitly importing the official upstream architecture from the selected revision.
        spec = importlib.util.spec_from_file_location("attendeye_minifas_export", folder / "MiniFASNet.py")
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        model = module.MiniFASNetV2(conv6_kernel=(5, 5))
        weights = torch.load(folder / "weights.pth", map_location="cpu", weights_only=True)
        weights = {key.removeprefix("module."): value for key, value in weights.items()}
        model.load_state_dict(weights, strict=True); model.eval()
        example = torch.zeros((1, 3, 80, 80), dtype=torch.float32)
        torch.onnx.export(model, example, str(destination), input_names=["input"], output_names=["logits"],
                          opset_version=12, dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}})
        onnx.checker.check_model(onnx.load(str(destination)))
        (destination.parent / "MiniFASNet-LICENSE.txt").write_bytes((folder / "LICENSE").read_bytes())
    manifest["sha256"][destination.name] = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix(".json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Exported {destination}. Provenance and SHA-256 manifest saved alongside it.")
    print("This is one MiniFASNetV2 model, not the upstream two-model ensemble. Evaluate on your cameras.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, KeyError, ValueError) as exc:
        raise SystemExit(f"Model setup failed: {exc}") from exc

#!/usr/bin/env python3
"""Split a mixed song into vocals + instrumental using Demucs."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def resolve_device() -> str:
    """Pick Demucs device. Defaults to CPU; set LUNA_STEM_DEVICE=cuda|auto for GPU."""
    pref = os.environ.get("LUNA_STEM_DEVICE", "cpu").strip().lower()
    if pref == "cpu":
        return "cpu"

    try:
        import torch
    except ImportError:
        return "cpu"

    cuda_ok = torch.cuda.is_available()
    mps_ok = hasattr(torch.backends, "mps") and torch.backends.mps.is_available()

    if pref in ("cuda", "gpu"):
        return "cuda" if cuda_ok else "cpu"
    if pref == "mps":
        return "mps" if mps_ok else "cpu"
    if pref == "auto":
        if cuda_ok:
            return "cuda"
        if mps_ok:
            return "mps"

    return "cpu"


def device_info() -> dict[str, object]:
    info: dict[str, object] = {
        "device": resolve_device(),
        "cuda_available": False,
        "mps_available": False,
        "gpu_name": None,
    }
    try:
        import torch

        info["cuda_available"] = torch.cuda.is_available()
        info["mps_available"] = (
            hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        )
        if info["cuda_available"]:
            info["gpu_name"] = torch.cuda.get_device_name(0)
    except ImportError:
        pass
    return info


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--device-info":
        print(json.dumps(device_info()))
        return

    if len(sys.argv) != 3:
        raise SystemExit("Usage: split_stems.py <input_audio> <work_dir>")

    input_path = Path(sys.argv[1]).resolve()
    work_dir = Path(sys.argv[2]).resolve()
    sep_root = work_dir / "separated"
    sep_root.mkdir(parents=True, exist_ok=True)

    if not input_path.is_file():
        raise SystemExit(f"Input not found: {input_path}")

    device = resolve_device()

    cmd = [
        sys.executable,
        "-m",
        "demucs",
        "--two-stems",
        "vocals",
        "-n",
        "htdemucs",
        "-d",
        device,
        "-o",
        str(sep_root),
        str(input_path),
    ]

    subprocess.run(
        cmd,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )

    out_base = sep_root / "htdemucs" / input_path.stem
    vocals = out_base / "vocals.wav"
    instrumental = out_base / "no_vocals.wav"

    if not vocals.is_file() or not instrumental.is_file():
        raise SystemExit(f"Demucs finished but outputs missing in {out_base}")

    manifest = {
        "vocals": str(vocals),
        "instrumental": str(instrumental),
        "device": device,
    }
    (work_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


if __name__ == "__main__":
    main()

"""
setup.py
--------
Optional setup script for Livery AI Studio.
Handles downloading Real-ESRGAN model weights for GPU upscaling.

Usage:
    python setup.py              # interactive — prompts before downloading
    python setup.py --upscale    # download weights without prompting
    python setup.py --check      # just report what is/isn't installed
"""

import argparse
import os
import sys
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"
WEIGHTS_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
WEIGHTS_FILE = MODELS_DIR / "RealESRGAN_x4plus.pth"
WEIGHTS_SIZE_MB = 67


def check_torch():
    try:
        import torch
        cuda = torch.cuda.is_available()
        gpu_name = torch.cuda.get_device_name(0) if cuda else "none"
        return True, cuda, gpu_name
    except ImportError:
        return False, False, "none"


def check_realesrgan():
    try:
        from realesrgan import RealESRGANer  # noqa: F401
        return True
    except ImportError as e:
        print(f"[DEBUG] realesrgan import failed: {e}")
        return False


def check_weights():
    return WEIGHTS_FILE.exists()


def download_weights():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading Real-ESRGAN weights ({WEIGHTS_SIZE_MB} MB)…")
    print(f"  From : {WEIGHTS_URL}")
    print(f"  To   : {WEIGHTS_FILE}")

    def _progress(block, block_size, total):
        downloaded = block * block_size
        pct = min(100, downloaded * 100 // total) if total > 0 else 0
        bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
        print(f"\r  [{bar}] {pct}%", end="", flush=True)

    urllib.request.urlretrieve(WEIGHTS_URL, WEIGHTS_FILE, reporthook=_progress)
    print(f"\n  ✓ Saved to {WEIGHTS_FILE}")


def print_status():
    torch_ok, cuda_ok, gpu_name = check_torch()
    esrgan_ok = check_realesrgan()
    weights_ok = check_weights()

    print("\nLivery AI Studio — Setup Status")
    print("═" * 50)
    print(f"  PyTorch installed   : {'✓' if torch_ok else '✗  run: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124'}")
    print(f"  CUDA available      : {'✓  ' + gpu_name if cuda_ok else '✗  (CPU only — upscaling will be very slow)'}")
    print(f"  Real-ESRGAN         : {'✓' if esrgan_ok else '✗  run: pip install realesrgan'}")
    print(f"  Model weights       : {'✓  ' + str(WEIGHTS_FILE) if weights_ok else '✗  run: python setup.py --upscale'}")
    print()

    if torch_ok and esrgan_ok and weights_ok:
        print("  ✓ Upscaling is fully configured and ready to use.\n")
    else:
        print("  Upscaling is OPTIONAL. The app works without it — generated")
        print("  textures will be resized to 2048×2048 using Lanczos instead.\n")


def main():
    parser = argparse.ArgumentParser(description="Livery AI Studio setup")
    parser.add_argument("--upscale", action="store_true", help="Download Real-ESRGAN weights without prompting")
    parser.add_argument("--check", action="store_true", help="Report installation status and exit")
    args = parser.parse_args()

    print_status()

    if args.check:
        return

    if check_weights():
        print("  Model weights already downloaded. Nothing to do.")
        return

    if args.upscale:
        download_weights()
        return

    # Interactive
    print("  Would you like to download the Real-ESRGAN model weights?")
    print(f"  Size: ~{WEIGHTS_SIZE_MB} MB  |  Required for GPU upscaling (optional)")
    answer = input("  Download? [y/N] ").strip().lower()
    if answer == "y":
        download_weights()
    else:
        print("  Skipped. You can run 'python setup.py --upscale' at any time.\n")


if __name__ == "__main__":
    main()

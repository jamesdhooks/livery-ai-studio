"""
server/seedvr2.py
-----------------
Optional AI-powered image resampling / upscaling using SeedVR2.

SeedVR2 is a diffusion-based upscaler that produces significantly higher
quality results than traditional upscaling (Real-ESRGAN) — especially for
AI-generated liveries — at the cost of longer processing time.

Installation:
    start.bat --seedvr           Install SeedVR2 + dependencies
    start.bat --gpu --seedvr     Install both Real-ESRGAN and SeedVR2

The SeedVR2 repo is cloned to <APP_DIR>/seedvr2_videoupscaler/ and invoked
via its CLI (inference_cli.py).

Workflow (resample):
    1. Downres input image to 1024×1024
    2. Run SeedVR2 inference_cli.py to upscale back to 2048×2048
    3. Return the 2048×2048 result
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

# App root — resolves correctly both from source and inside a PyInstaller bundle
_APP_DIR = (
    Path(sys.executable).parent
    if getattr(sys, "frozen", False)
    else Path(__file__).parent.parent
)

# Where we expect the SeedVR2 repo to be cloned
SEEDVR2_DIR = _APP_DIR / "seedvr2_videoupscaler"
SEEDVR2_CLI = SEEDVR2_DIR / "inference_cli.py"

# GGUF quantized model for low VRAM — users can also use the full model
SEEDVR2_GGUF_MODEL = "seedvr2_ema_3b-Q8_0.gguf"


def is_available() -> bool:
    """Return True if SeedVR2 CLI and dependencies are installed."""
    if not SEEDVR2_DIR.exists():
        print(f"[seedvr2] SeedVR2 dir not found at {SEEDVR2_DIR}")
        return False
    if not SEEDVR2_CLI.exists():
        print(f"[seedvr2] CLI script not found at {SEEDVR2_CLI}")
        return False

    try:
        import torch  # noqa: F401
        print("[seedvr2] torch ✓")
    except ImportError as e:
        print(f"[seedvr2] torch import failed: {e}")
        return False

    print("[seedvr2] SeedVR2 available ✓")
    return True


def _get_python_exe() -> str:
    """Return the Python executable path inside our venv."""
    venv_dir = _APP_DIR / ".venv"
    if sys.platform == "win32":
        py = venv_dir / "Scripts" / "python.exe"
    else:
        py = venv_dir / "bin" / "python"
    if py.exists():
        return str(py)
    return sys.executable


def resample(image: Image.Image, use_gguf: bool = True) -> Image.Image:
    """
    Resample an image using SeedVR2:
      1. Downres to 1024×1024
      2. Run through SeedVR2 CLI → 2048×2048

    Args:
        image: PIL Image (any mode; will be converted to RGB internally).
        use_gguf: If True, use the GGUF quantized model for lower VRAM usage.

    Returns:
        2048×2048 PIL Image in RGBA mode.

    Raises:
        RuntimeError: if SeedVR2 is not available or the CLI fails.
    """
    if not is_available():
        raise RuntimeError(
            "SeedVR2 is not available. "
            "Run start.bat --seedvr to install SeedVR2."
        )

    # Preserve alpha if present
    has_alpha = image.mode == "RGBA"
    if has_alpha:
        alpha = image.split()[-1]

    rgb = image.convert("RGB")

    # Step 1: Downres to 1024×1024
    print(f"[seedvr2] Downresizing {rgb.size} → 1024×1024")
    downresized = rgb.resize((1024, 1024), Image.LANCZOS)

    # Create temp files for input/output
    with tempfile.TemporaryDirectory(prefix="seedvr2_") as tmpdir:
        input_path = Path(tmpdir) / "input.png"
        downresized.save(str(input_path), format="PNG")

        # Build the CLI command
        python_exe = _get_python_exe()
        cmd = [
            python_exe,
            str(SEEDVR2_CLI),
            str(input_path),
            "--resolution", "2048",
        ]

        # Use GGUF model for lower VRAM if available
        if use_gguf:
            gguf_path = SEEDVR2_DIR / SEEDVR2_GGUF_MODEL
            if gguf_path.exists():
                cmd.extend(["--dit_model", str(gguf_path)])
                # Low VRAM optimizations
                cmd.extend([
                    "--blocks_to_swap", "32",
                    "--swap_io_components",
                    "--dit_offload_device", "cpu",
                    "--vae_offload_device", "cpu",
                ])
            else:
                print(f"[seedvr2] GGUF model not found at {gguf_path}, using default model")

        print(f"[seedvr2] Running CLI: {' '.join(cmd)}")

        try:
            result = subprocess.run(
                cmd,
                cwd=str(SEEDVR2_DIR),
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                env={**os.environ, "PYTHONPATH": str(SEEDVR2_DIR)},
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError("SeedVR2 timed out after 5 minutes")

        if result.returncode != 0:
            print(f"[seedvr2] CLI stderr: {result.stderr}")
            raise RuntimeError(f"SeedVR2 CLI failed: {result.stderr[:500]}")

        print(f"[seedvr2] CLI stdout: {result.stdout[-500:]}")

        # Find the output file — SeedVR2 outputs to the same directory
        # with _upscaled or similar suffix, or an output/ subdirectory
        output_candidates = [
            Path(tmpdir) / "input_upscaled.png",
            Path(tmpdir) / "input_sr.png",
            Path(tmpdir) / "output" / "input.png",
            Path(tmpdir) / "output" / "input_upscaled.png",
        ]

        # Also search for any new PNG in tmpdir and output/ subdir
        for search_dir in [Path(tmpdir), Path(tmpdir) / "output"]:
            if search_dir.exists():
                for f in sorted(search_dir.glob("*.png")):
                    if f.name != "input.png" and f not in output_candidates:
                        output_candidates.insert(0, f)

        output_path = None
        for candidate in output_candidates:
            if candidate.exists():
                output_path = candidate
                break

        if output_path is None:
            # List what files exist for debugging
            all_files = list(Path(tmpdir).rglob("*"))
            raise RuntimeError(
                f"SeedVR2 output file not found. "
                f"Files in temp dir: {[str(f) for f in all_files]}"
            )

        print(f"[seedvr2] Output found at: {output_path}")
        upscaled = Image.open(str(output_path))

    # Ensure exact 2048×2048
    if upscaled.size != (2048, 2048):
        print(f"[seedvr2] Resizing {upscaled.size} → 2048×2048")
        upscaled = upscaled.resize((2048, 2048), Image.LANCZOS)

    result_img = upscaled.convert("RGBA")

    # Re-apply original alpha if image had one
    if has_alpha:
        alpha_resized = alpha.resize((2048, 2048), Image.LANCZOS)
        result_img.putalpha(alpha_resized)

    return result_img

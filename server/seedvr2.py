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
import time
from pathlib import Path

from PIL import Image

from server.upscale import _resize_aspect_aware

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


def _get_gpu_count() -> int:
    """Return the number of available CUDA GPUs, or 0 if CUDA is not available."""
    try:
        import torch
        return torch.cuda.device_count() if torch.cuda.is_available() else 0
    except Exception:
        return 0


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


def resample(image: Image.Image, use_gguf: bool = True, use_multi_gpu: bool = False, target_size: int = 2048) -> Image.Image:
    """
    Resample an image using SeedVR2.

    The caller is responsible for pre-downscaling (and optionally adding noise)
    before calling this. SeedVR2 will upscale the input to ``target_size``.

    Args:
        image:       PIL Image already pre-processed by the caller.
        use_gguf:      If True, use the GGUF quantized model for lower VRAM usage.
        use_multi_gpu: Enable multi-GPU mode when multiple GPUs are detected.
        target_size:   Target upscale resolution (default 2048).

    Returns:
        ``target_size``×``target_size`` PIL Image in RGBA mode.

    Raises:
        RuntimeError: if SeedVR2 is not available or the CLI fails.
    """
    return _run_seedvr2(image, downres=False, use_gguf=use_gguf, use_multi_gpu=use_multi_gpu, target_size=target_size)


def upscale_direct(image: Image.Image, use_gguf: bool = True, use_multi_gpu: bool = False, target_size: int = 2048) -> Image.Image:
    """
    Upscale an image directly using SeedVR2 without downresizing first.
    Passes the image at its original resolution straight to SeedVR2.

    Args:
        image: PIL Image (any mode; will be converted to RGB internally).
        use_gguf: If True, use the GGUF quantized model for lower VRAM usage.
        target_size: Target output resolution (default 2048).

    Returns:
        PIL Image in RGBA mode at target resolution.

    Raises:
        RuntimeError: if SeedVR2 is not available or the CLI fails.
    """
    return _run_seedvr2(image, downres=False, use_gguf=use_gguf, use_multi_gpu=use_multi_gpu, target_size=target_size)


def _run_seedvr2(image: Image.Image, downres: bool = True, use_gguf: bool = True, use_multi_gpu: bool = False, target_size: int = 2048) -> Image.Image:
    """
    Core SeedVR2 runner.

    Args:
        image:         PIL Image to process.
        downres:       If True, downres to 1024×1024 before running SeedVR2.
                       If False, pass the image at its current resolution.
        use_gguf:      Use GGUF quantized model for lower VRAM usage.
        use_multi_gpu: Enable multi-GPU mode when multiple GPUs are detected.
        target_size:   Target output resolution (default 2048).

    Returns:
        ``target_size``×``target_size`` PIL Image in RGBA mode.
    """
    start_time = time.time()
    print(f"[seedvr2] _run_seedvr2 starting (downres={downres}, target={target_size})")
    
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

    if downres:
        downres_start = time.time()
        print(f"[seedvr2] Downresizing {rgb.size} → 1024×1024")
        input_image = rgb.resize((1024, 1024), Image.LANCZOS)
        downres_elapsed = time.time() - downres_start
        print(f"[seedvr2] Downres complete in {downres_elapsed:.2f}s")
    else:
        print(f"[seedvr2] Using image at current resolution: {rgb.size}")
        input_image = rgb

    # Create temp files for input/output
    with tempfile.TemporaryDirectory(prefix="seedvr2_") as tmpdir:
        input_path = Path(tmpdir) / "input.png"
        input_image.save(str(input_path), format="PNG")

        # Build the CLI command
        python_exe = _get_python_exe()
        cmd = [
            python_exe,
            str(SEEDVR2_CLI),
            str(input_path),
            "--resolution", str(target_size),
        ]

        # Configure GPU device(s)
        gpu_count = _get_gpu_count()
        if use_multi_gpu and gpu_count >= 2:
            # Multi-GPU setup: use both GPUs
            print(f"[seedvr2] Detected {gpu_count} GPUs - enabling multi-GPU mode")
            cmd.extend(["--cuda_device", "0,1"])
        elif gpu_count >= 1:
            print(f"[seedvr2] Using single GPU (multi-GPU {'disabled by setting' if gpu_count >= 2 else 'N/A - only 1 GPU'})")
            cmd.extend(["--cuda_device", "0"])

        # Always enable VAE tiling for reduced VRAM usage
        cmd.extend([
            "--vae_encode_tiled",
            "--vae_decode_tiled",
        ])

        # Use GGUF model for lower VRAM if available
        if use_gguf:
            gguf_path = SEEDVR2_DIR / SEEDVR2_GGUF_MODEL
            if gguf_path.exists():
                # Pass only the filename, not the full path (SeedVR2 CLI expects just the model name)
                cmd.extend(["--dit_model", SEEDVR2_GGUF_MODEL])
                # Aggressive block swapping + offloading for minimal VRAM
                cmd.extend([
                    "--blocks_to_swap", "32",
                    "--swap_io_components",
                    "--dit_offload_device", "cpu",
                    "--vae_offload_device", "cpu",
                ])
            else:
                # GGUF not found — silently use default FP8 model
                pass

        print(f"[seedvr2] Running CLI: {' '.join(cmd)}")

        cli_start = time.time()
        print(f"[seedvr2] Subprocess starting... (this may take 1-5 minutes)")
        try:
            result = subprocess.run(
                cmd,
                cwd=str(SEEDVR2_DIR),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=300,  # 5 minute timeout
                env={**os.environ, "PYTHONPATH": str(SEEDVR2_DIR), "PYTHONIOENCODING": "utf-8"},
            )
            cli_elapsed = time.time() - cli_start
            print(f"[seedvr2] CLI finished in {cli_elapsed:.1f}s")
        except subprocess.TimeoutExpired:
            raise RuntimeError("SeedVR2 timed out after 5 minutes")

        if result.returncode != 0:
            print(f"[seedvr2] CLI stderr: {result.stderr}")
            
            # Check for VRAM exhaustion errors
            if "OutOfMemoryError" in result.stderr or "out of memory" in result.stderr or "Allocation on device" in result.stderr:
                raise RuntimeError("OutOfMemoryError: VRAM exhausted during SeedVR2 processing")
            
            raise RuntimeError(f"SeedVR2 CLI failed: {result.stderr[:500]}")

        print(f"[seedvr2] CLI stdout (last 500 chars): {result.stdout[-500:]}")

        # Find the output file — SeedVR2 outputs to the same directory
        # with _upscaled or similar suffix, or an output/ subdirectory
        search_start = time.time()
        print(f"[seedvr2] Searching for output file...")
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
            all_files = list(Path(tmpdir).rglob("*"))
            raise RuntimeError(
                f"SeedVR2 output file not found. "
                f"Files in temp dir: {[str(f) for f in all_files]}"
            )

        search_elapsed = time.time() - search_start
        print(f"[seedvr2] Output found at: {output_path} (search took {search_elapsed:.2f}s)")
        
        # Load the image into memory BEFORE exiting the temp directory context
        # This ensures the file handle is released so the temp directory can be cleaned up
        upscaled = Image.open(str(output_path))
        upscaled.load()  # Force load into memory
        upscaled_copy = upscaled.copy()  # Make a copy to ensure complete detachment
        upscaled = upscaled_copy

    # Ensure fits within target_size using aspect-aware resizing
    if upscaled.size != (target_size, target_size):
        resize_start = time.time()
        print(f"[seedvr2] Resizing {upscaled.size} → {target_size}px (longest side, aspect-aware)")
        upscaled = _resize_aspect_aware(upscaled, target_size)
        resize_elapsed = time.time() - resize_start
        print(f"[seedvr2] Resize complete in {resize_elapsed:.2f}s")

    result_img = upscaled.convert("RGBA")

    # Re-apply original alpha if image had one
    # Alpha must be resized to match the final image dimensions (after aspect-aware resize)
    if has_alpha:
        # Resize alpha using the same aspect-aware logic as the image
        alpha_resized = _resize_aspect_aware(alpha, target_size)
        # Ensure dimensions match exactly (should already, but be safe)
        if alpha_resized.size != result_img.size:
            alpha_resized = alpha_resized.resize(result_img.size, Image.LANCZOS)
        result_img.putalpha(alpha_resized)

    total_elapsed = time.time() - start_time
    print(f"[seedvr2] _run_seedvr2 complete in {total_elapsed:.1f}s")
    return result_img

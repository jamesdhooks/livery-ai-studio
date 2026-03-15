"""
upscale.py
----------
Optional GPU-accelerated upscaling using Real-ESRGAN.

Requirements (optional — upscaling will be skipped if not installed):
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
    pip install realesrgan
    # Then patch basicsr (see setup.py or GETTING_STARTED.md):
    # sed -i 's/functional_tensor/functional/' <site-packages>/basicsr/data/degradations.py

Model weights:
    Place RealESRGAN_x4plus.pth in the models/ folder of this project.
    Download from: https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from PIL import Image

# App root — resolves correctly both from source and inside a PyInstaller bundle
_APP_DIR = (
    Path(sys.executable).parent
    if getattr(sys, "frozen", False)
    else Path(__file__).parent.parent
)

# Where we expect the weights to live
_WEIGHTS_PATH = _APP_DIR / "models" / "RealESRGAN_x4plus.pth"

# Cached model instance — loaded once per process
_model_instance = None


def is_available() -> bool:
    """Return True if Real-ESRGAN and model weights are both present."""
    if not _WEIGHTS_PATH.exists():
        print(f"[upscale] Weights not found at {_WEIGHTS_PATH}")
        return False
    try:
        import torch  # noqa: F401
        print("[upscale] torch ✓")
    except ImportError as e:
        print(f"[upscale] torch import failed: {e}")
        return False
    
    try:
        from realesrgan import RealESRGANer  # noqa: F401
        print("[upscale] realesrgan ✓")
    except ImportError as e:
        print(f"[upscale] realesrgan import failed: {e}")
        return False
    
    print("[upscale] All imports OK - upscaling available")
    return True


def upscale_to_2048(image: Image.Image, tile: int = 512) -> Image.Image:
    """
    Upscale `image` using Real-ESRGAN x4, then crop/resize to exactly 2048×2048.

    Args:
        image: PIL Image (any mode; will be converted to RGB internally)
        tile:  Tile size for VRAM-safe inference. Reduce to 256 on <8GB GPUs.

    Returns:
        2048×2048 PIL Image in RGBA mode.

    Raises:
        RuntimeError: if Real-ESRGAN or weights are not available.
    """
    global _model_instance

    if not is_available():
        raise RuntimeError(
            "Real-ESRGAN upscaling is not available. "
            "Run setup.py or see GETTING_STARTED.md for installation steps."
        )

    import torch
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[upscale] Using device: {device}")

    if _model_instance is None:
        print(f"[upscale] Loading weights from {_WEIGHTS_PATH} …")
        rrdb = RRDBNet(
            num_in_ch=3, num_out_ch=3,
            num_feat=64, num_block=23, num_grow_ch=32,
            scale=4,
        )

        # Pre-load weights ourselves to handle PyTorch 2.6+ compatibility.
        # RealESRGANer internally calls torch.load(model_path) which can fail
        # with newer PyTorch defaults (weights_only=True) or with path issues.
        # By loading here and passing model_path=None, we bypass that.
        if not _WEIGHTS_PATH.exists():
            raise FileNotFoundError(f"Model weights not found at {_WEIGHTS_PATH}")
        
        # Verify file is readable
        file_size = _WEIGHTS_PATH.stat().st_size
        print(f"[upscale] Weights file size: {file_size / 1024 / 1024:.1f} MB")
        
        if file_size < 1_000_000:  # Less than 1 MB is suspicious
            raise RuntimeError(f"Weights file seems corrupted (too small: {file_size} bytes)")
        
        try:
            loadnet = torch.load(str(_WEIGHTS_PATH), map_location=device, weights_only=False)
        except TypeError:
            # Older PyTorch doesn't have weights_only parameter
            loadnet = torch.load(str(_WEIGHTS_PATH), map_location=device)
        except Exception as e:
            raise RuntimeError(f"Failed to load weights from {_WEIGHTS_PATH}: {e}")

        # The weights file may wrap the state dict under 'params_ema' or 'params'
        if "params_ema" in loadnet:
            keyname = "params_ema"
        elif "params" in loadnet:
            keyname = "params"
        else:
            keyname = None

        if keyname:
            rrdb.load_state_dict(loadnet[keyname], strict=True)
        else:
            rrdb.load_state_dict(loadnet, strict=True)

        rrdb.eval()
        rrdb = rrdb.to(device)

        _model_instance = RealESRGANer(
            scale=4,
            model_path=str(_WEIGHTS_PATH),
            model=rrdb,
            tile=tile,
            tile_pad=10,
            pre_pad=0,
            half=device.type == "cuda",  # fp16 on GPU, fp32 on CPU
            device=device,
        )
        print("[upscale] Model loaded.")

    # Real-ESRGAN works on RGB numpy arrays
    import numpy as np
    import cv2

    # Preserve alpha if present
    has_alpha = image.mode == "RGBA"
    if has_alpha:
        alpha = image.split()[-1]  # keep original alpha channel

    rgb = image.convert("RGB")
    bgr = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)

    print(f"[upscale] Upscaling {image.size} → ×4 …")
    output_bgr, _ = _model_instance.enhance(bgr, outscale=4)
    output_rgb = cv2.cvtColor(output_bgr, cv2.COLOR_BGR2RGB)
    upscaled = Image.fromarray(output_rgb)
    print(f"[upscale] Upscaled size: {upscaled.size}")

    # Resize to exact 2048×2048 (upscaled from 1024 will be 4096, so downsample cleanly)
    if upscaled.size != (2048, 2048):
        print(f"[upscale] Resizing {upscaled.size} → 2048×2048")
        upscaled = upscaled.resize((2048, 2048), Image.LANCZOS)

    result = upscaled.convert("RGBA")

    # Re-apply original alpha if image had one
    if has_alpha:
        alpha_resized = alpha.resize((2048, 2048), Image.LANCZOS)
        result.putalpha(alpha_resized)

    return result

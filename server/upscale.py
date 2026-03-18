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


def _resize_aspect_aware(image: Image.Image, target_size: int) -> Image.Image:
    """
    Resize image to target size while preserving aspect ratio.
    The target_size becomes the length of the longest side.
    Shorter side is scaled proportionally.
    """
    w, h = image.size
    max_dim = max(w, h)
    
    if max_dim == target_size:
        return image
    
    # Scale both dimensions proportionally
    scale = target_size / max_dim
    new_w = int(w * scale)
    new_h = int(h * scale)
    
    return image.resize((new_w, new_h), Image.LANCZOS)


def upscale_to_2048(image: Image.Image, tile: int = 512) -> Image.Image:
    """
    Upscale `image` using Real-ESRGAN x4, then resize to 2048px (longest side).
    Aspect ratio is preserved — target_size becomes the length of the longest dimension.

    Args:
        image: PIL Image (any mode; will be converted to RGB internally)
        tile:  Tile size for VRAM-safe inference. Reduce to 256 on <8GB GPUs.

    Returns:
        PIL Image in RGBA mode with longest side = 2048px (aspect ratio preserved).

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

    # Resize to 2048px on longest side (aspect ratio aware)
    upscaled = _resize_aspect_aware(upscaled, 2048)
    print(f"[upscale] Final size (longest side = 2048): {upscaled.size}")

    result = upscaled.convert("RGBA")

    # Re-apply original alpha if image had one (also aspect-aware)
    if has_alpha:
        alpha_resized = _resize_aspect_aware(alpha, 2048)
        result.putalpha(alpha_resized)

    return result


def resample_to_2048(image: Image.Image) -> Image.Image:
    """
    Resample `image` using Real-ESRGAN: downres to 1024×1024, then upscale to 2048×2048.
    Legacy wrapper — prefer ``resample_image`` for configurable sizes.
    """
    print(f"[upscale] Resampling: downresizing {image.size} → 1024×1024")
    downresized = image.resize((1024, 1024), Image.LANCZOS)
    print("[upscale] Running Real-ESRGAN on 1024×1024 input…")
    return upscale_to_2048(downresized)


def resample_image(image: Image.Image, target_size: int = 2048) -> Image.Image:
    """
    Upscale ``image`` using Real-ESRGAN 4×, then resize to ``target_size`` (longest side).

    The image is assumed to already be pre-processed (downscaled, noised, etc.)
    by the caller. This function only runs the upscale and final resize.
    Aspect ratio is preserved — target_size becomes the length of the longest dimension.

    Args:
        image:       PIL Image to upscale (the pre-downscaled input).
        target_size: Target resolution for the longest side (e.g. 2048, 4096).

    Returns:
        PIL Image in RGBA mode with longest side = target_size (aspect ratio preserved).
    """
    global _model_instance

    if not is_available():
        raise RuntimeError(
            "Real-ESRGAN upscaling is not available. "
            "Run setup.py or see GETTING_STARTED.md for installation steps."
        )

    import torch
    import numpy as np
    import cv2
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Load model if needed (mirrors upscale_to_2048 loading logic)
    if _model_instance is None:
        rrdb = RRDBNet(
            num_in_ch=3, num_out_ch=3,
            num_feat=64, num_block=23, num_grow_ch=32,
            scale=4,
        )
        try:
            loadnet = torch.load(str(_WEIGHTS_PATH), map_location=device, weights_only=False)
        except TypeError:
            loadnet = torch.load(str(_WEIGHTS_PATH), map_location=device)
        keyname = "params_ema" if "params_ema" in loadnet else ("params" if "params" in loadnet else None)
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
            tile=512,
            tile_pad=10,
            pre_pad=0,
            half=device.type == "cuda",
            device=device,
        )

    has_alpha = image.mode == "RGBA"
    if has_alpha:
        alpha = image.split()[-1]

    rgb = image.convert("RGB")
    bgr = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)

    print(f"[upscale] resample_image: upscaling {image.size} → ×4 (target longest side: {target_size}px)")
    output_bgr, _ = _model_instance.enhance(bgr, outscale=4)
    output_rgb = cv2.cvtColor(output_bgr, cv2.COLOR_BGR2RGB)
    upscaled = Image.fromarray(output_rgb)

    # Resize to target_size on longest side (aspect ratio aware)
    upscaled = _resize_aspect_aware(upscaled, target_size)
    print(f"[upscale] resample_image: final size (longest side = {target_size}): {upscaled.size}")

    result = upscaled.convert("RGBA")
    if has_alpha:
        alpha_resized = _resize_aspect_aware(alpha, target_size)
        result.putalpha(alpha_resized)

    return result

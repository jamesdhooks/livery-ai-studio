"""
generate_livery.py
------------------
Calls the Google Gemini image generation API to generate an iRacing livery.

Usage:
    python generate_livery.py \
        --prompt "Gulf Racing livery, orange and blue, large #7 on doors" \
        --wireframe path/to/wireframe.png \
        --output path/to/output.tga \
        [--base path/to/base_diffuse.png] \
        [--car-id porsche_911_gt3_r] \
        [--customer-id 123456]
"""

from __future__ import annotations

import argparse
import base64
import os
import sys
from pathlib import Path

# ── SSL fix: must happen before google-genai is imported ─────────────────────
try:
    import ssl as _ssl
    import certifi as _certifi
    _cert_path = _certifi.where()
    os.environ["SSL_CERT_FILE"] = _cert_path
    os.environ["REQUESTS_CA_BUNDLE"] = _cert_path
    _orig_ssl_ctx = _ssl.create_default_context
    def _patched_ssl_ctx(*args, **kwargs):
        kwargs["cafile"] = _cert_path   # always override — conda default is broken
        kwargs.pop("capath", None)       # capath conflicts with cafile
        return _orig_ssl_ctx(*args, **kwargs)
    _ssl.create_default_context = _patched_ssl_ctx
except Exception as _e:
    print(f"[SSL] Warning: could not patch SSL: {_e}")
# ─────────────────────────────────────────────────────────────────────────────

from google import genai
from google.genai import types
from PIL import Image
import io


# ─── Model selection ─────────────────────────────────────────────────────────
# Use Gemini Pro for best quality (paid, ~$0.13/image at 2K)
# Use Gemini Flash for cheaper/faster generation
MODEL_PRO   = "gemini-3-pro-image-preview"
MODEL_FAST  = "gemini-3.1-flash-image-preview"
# ─────────────────────────────────────────────────────────────────────────────


def load_image_as_bytes(path: str) -> bytes:
    """Load an image file and return raw bytes. Converts TGA to JPG automatically."""
    try:
        print(f"[load_image_as_bytes] Loading {path}")
        
        # Convert TGA to JPG
        if path.lower().endswith(".tga"):
            print(f"[load_image_as_bytes] Converting TGA to JPG: {path}")
            img = Image.open(path).convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=95)
            data = buf.getvalue()
        else:
            with open(path, "rb") as f:
                data = f.read()
        
        print(f"[load_image_as_bytes] Loaded {len(data)} bytes")
        return data
    except FileNotFoundError as e:
        print(f"[load_image_as_bytes] ERROR: File not found at {path}")
        raise
    except Exception as e:
        print(f"[load_image_as_bytes] ERROR: {e}")
        raise


def get_image_mime_type(path: str) -> str:
    """Determine the MIME type for an image file. TGA files return as JPEG."""
    if path.lower().endswith(".tga"):
        return "image/jpeg"  # TGA converted to JPEG
    elif path.lower().endswith(".png"):
        return "image/png"
    else:
        return "image/jpeg"


def build_prompt(
    user_prompt: str,
    mode: str = "new",           # "new" | "modify" | "iterate"
    has_wireframe: bool = True,
    has_base: bool = False,
    car_display: str = "",
    has_reference: bool = False,
    reference_count: int = 0,
    reference_context: str = "",
) -> str:
    """
    Build the full system + task prompt for Gemini image generation.
    mode="new"      → generate a brand-new livery design
    mode="modify"   → apply targeted changes to the provided base texture
    mode="iterate"  → refine/iterate on a previously generated livery
    """

    # ── Wireframe instruction (always present when a wireframe is supplied) ───
    wireframe_block = ""
    if has_wireframe:
        wireframe_block = """
IMAGE 1 — UV WIREFRAME (structural guide, must be invisible in output):
The first image is the car's UV panel wireframe. It shows the exact layout of every body panel in UV-texture space — doors, bonnet, roof, bumpers, side skirts, wheel arches, splitters, wings, and mirrors all have specific positions and boundaries within this 2048×2048 grid.

YOUR SINGLE MOST IMPORTANT INSTRUCTION:
Map every element of your livery design — colours, graphics, stripes, numbers, logos — directly onto the panel positions shown in this wireframe. The wireframe IS the coordinate system for your output. If a panel boundary runs diagonally, your graphics must follow that diagonal. If a door panel occupies the left-centre of the UV space, your door graphics must sit precisely there. Treat the wireframe like an architectural floor plan: every design decision is made relative to what you see in it.

WHAT TO DO WITH THE WIREFRAME:
- Study each panel's exact position, size, shape, and orientation in UV space.
- Place graphics, stripes, colour transitions, and logos so they land on the correct panel regions as defined by the wireframe boundaries.
- Respect panel seams — design elements that span multiple panels must account for seam positions so they read correctly on the 3D car.
- Identify the bonnet, roof, doors, rear quarter, bumpers, and wings by their positions in the wireframe and design for each panel specifically.
- The UV map contains mirrored/flipped regions for both sides of the car; respect the actual panel layout shown rather than assuming simple left-right symmetry.

WHAT NOT TO DO WITH THE WIREFRAME:
- Do NOT reproduce the wireframe lines, grid, overlay, or any part of its visual appearance in your output texture.
- Do NOT include visible seam lines, panel edge markers, UV guides, or structural overlays in the result.
- The wireframe lines must be 100% invisible in the final texture — only the design you paint on top of those panels should appear.
""".strip()

    # ── Reference image instruction (optional visual context) ────────────────
    reference_block = ""
    if has_reference:
        ref_ctx = f"\nUSER'S REFERENCE CONTEXT: {reference_context}" if reference_context else ""
        if reference_count > 1:
            reference_block = f"""
REFERENCE IMAGES ({reference_count} provided as additional images after the base/wireframe):
Multiple reference images have been supplied. Use them collectively as visual inspiration or context for the design.
- The references are guides, NOT templates — do not replicate them pixel-for-pixel.
- Draw stylistic cues, colour palette ideas, or layout patterns from them as appropriate.
- Consider each reference image and synthesise the best elements from all of them.
- Prioritise the user's written prompt over the reference images when they conflict.{ref_ctx}
""".strip()
        else:
            reference_block = f"""
REFERENCE IMAGE (provided as an additional image):
A reference image has been supplied. Use it as visual inspiration or context for the design.
- The reference is a guide, NOT a template — do not replicate it pixel-for-pixel.
- Draw stylistic cues, colour palette ideas, or layout patterns from it as appropriate.
- Prioritise the user's written prompt over the reference image when they conflict.{ref_ctx}
""".strip()

    # ── Mode-specific task block ──────────────────────────────────────────────
    if mode == "iterate":
        if has_base:
            task_block = """
TASK — ITERATE ON PREVIOUS GENERATION:
The second image is a livery you previously generated. The user wants to refine it.
- This is an iterative refinement — the previous output is your starting point.
- Preserve the overall design language, colour scheme, and composition UNLESS the instruction explicitly changes them.
- Apply the requested changes with surgical precision — only modify what is asked for.
- The result should look like a polished evolution of the previous version, not a completely new design.
- Fix any artefacts, misalignments, or quality issues from the previous generation while applying the changes.
""".strip()
        else:
            task_block = """
TASK — ITERATE ON DESIGN (no previous image provided):
The user wants to iterate on a previous design, but no reference image was supplied.
- Generate a fresh livery following the instruction below, but aim for a refined, polished result as if this were a second-pass improvement.
""".strip()

    elif mode == "modify":
        if has_base:
            task_block = """
TASK — MODIFY EXISTING LIVERY:
The second image is the current livery texture that must be modified.
- Treat this existing texture as the authoritative source of truth for the car's current look.
- Preserve every aspect of the existing design (colours, graphics, logos, number placement, sponsor decals, panel transitions) EXCEPT where the modification instruction below explicitly changes something.
- Apply the requested modification cleanly and seamlessly — it must look like it was always part of the original design.
- Do NOT redesign, recolour, or recompose any part of the livery that the modification instruction does not mention.
- Maintain the same overall style, finish (matte/gloss/satin), and visual language of the original.
""".strip()
        else:
            task_block = """
TASK — MODIFY LIVERY (no base provided):
No existing texture was supplied.
- Infer a clean, neutral base livery appropriate to a modern racing car.
- Apply the modification instruction below as if it were being added to that neutral base.
""".strip()

    else:  # mode == "new"
        if has_base:
            task_block = """
TASK — GENERATE NEW LIVERY (with base reference):
The second image is a reference base texture or colour scheme.
- Use it as a loose creative reference for colour palette, team branding, or overall style direction.
- You are NOT required to replicate it exactly — design a fresh, complete livery that is inspired by it.
- The final output should look like a fully new professional livery design, not a traced copy.
""".strip()
        else:
            task_block = """
TASK — GENERATE COMPLETELY NEW LIVERY:
No reference texture has been provided.
- Design an entirely original, professional racing livery from scratch.
- Express creative confidence — choose a strong, coherent colour palette and visual identity.
- The result should look like a real, race-ready livery you might see on a professional motorsport grid.
""".strip()

    # ── Shared technical requirements ────────────────────────────────────────
    technical_block = """
TECHNICAL REQUIREMENTS (non-negotiable):
- Output format: flat UV texture map, exactly 2048 × 2048 pixels, square (1:1 aspect ratio)
- Do NOT render any 3D shading, ambient occlusion, specular highlights, reflections, or lighting bakes — the texture must be completely flat / unlit
- Wheel arches, window glass, and other transparent/cutout areas must be solid black (#000000)
- No drop shadows on graphics — flat vector-quality edges only
- All race numbers, sponsor text, and logos must be correctly oriented (readable from outside the car) and legible at race distance
- Colour values must be clean, saturated, and consistent — avoid muddy or desaturated hues
- Do NOT include any background, studio floor, car 3D model, mockup frame, or scene context — output the raw texture map ONLY
""".strip()

    # ── User's specific instruction ───────────────────────────────────────────
    if mode == "modify":
        instruction_label = "MODIFICATION INSTRUCTION:"
    elif mode == "iterate":
        instruction_label = "ITERATION INSTRUCTION:"
    else:
        instruction_label = "LIVERY DESIGN BRIEF:"

    # ── Wireframe closing reminder (injected after user brief) ──────────────
    wireframe_closing = ""
    if has_wireframe:
        wireframe_closing = """
FINAL REMINDER — UV STRUCTURE IS MANDATORY:
Before rendering any pixel, re-examine IMAGE 1 (the wireframe). Every colour, stripe, graphic, and logo in your output must be positioned relative to the panel boundaries visible in that wireframe. A livery that ignores the UV layout and paints arbitrary shapes over a blank canvas is a failure — the result must map correctly onto the 3D car. The wireframe lines themselves must be invisible, but the structure they define must govern every placement decision you make.""".strip()

    # ── Base-image structure reminder ─────────────────────────────────────────
    base_structure_reminder = ""
    if has_base:
        base_structure_reminder = """CRITICAL REMINDER: You MUST follow the provided base image's structural layout (panel positions, UV mapping, orientation, and boundaries) but NOT its visual appearance (colours, graphics, patterns). The base image defines WHERE things go; your design defines WHAT they look like.""".strip()

    # ── Assemble ─────────────────────────────────────────────────────────────
    parts = ["You are a professional racing livery artist generating a UV texture for iRacing simulation software.\n"]
    if wireframe_block:
        parts.append(wireframe_block)
    if reference_block:
        parts.append(reference_block)
    parts.append(task_block)
    parts.append(technical_block)
    if base_structure_reminder:
        parts.append(base_structure_reminder)
    parts.append(f"{instruction_label}\n{user_prompt}")
    if wireframe_closing:
        parts.append(wireframe_closing)

    return "\n\n".join(parts)


def generate_livery(
    prompt: str,
    wireframe_path: str,
    output_path: str,
    base_path: str | None = None,
    reference_paths: list[str] | None = None,
    reference_context: str | None = None,
    model: str = MODEL_PRO,
    api_key: str | None = None,
    mode: str = "new",
    car_display: str = "",
    upscale: bool = False,
    resolution_2k: bool = True,
    # Legacy compat — single reference_path still accepted
    reference_path: str | None = None,
) -> str:
    """
    Call the Gemini image generation API to generate the livery texture.
    Returns the path to the saved .tga file.
    """

    # Initialise client
    client = genai.Client(api_key=api_key or os.environ.get("GEMINI_API_KEY"))

    # Merge legacy single reference_path into reference_paths list
    if reference_paths is None:
        reference_paths = []
    if reference_path and reference_path not in reference_paths:
        reference_paths.insert(0, reference_path)

    # Build image parts
    print(f"[generate_livery] Loading wireframe from {wireframe_path}")
    wireframe_bytes = load_image_as_bytes(wireframe_path)
    wireframe_mime  = get_image_mime_type(wireframe_path)

    contents: list = [
        types.Part.from_bytes(data=wireframe_bytes, mime_type=wireframe_mime),
    ]

    if base_path:
        print(f"[generate_livery] Loading base texture from {base_path}")
        base_bytes = load_image_as_bytes(base_path)
        base_mime  = get_image_mime_type(base_path)
        contents.append(types.Part.from_bytes(data=base_bytes, mime_type=base_mime))

    # Load all reference images
    for ref_p in reference_paths:
        print(f"[generate_livery] Loading reference image from {ref_p}")
        ref_bytes = load_image_as_bytes(ref_p)
        ref_mime = get_image_mime_type(ref_p)
        contents.append(types.Part.from_bytes(data=ref_bytes, mime_type=ref_mime))

    has_refs = len(reference_paths) > 0

    # Append the text prompt
    contents.append(types.Part.from_text(text=build_prompt(
        prompt,
        mode=mode,
        has_wireframe=bool(wireframe_path),
        has_base=bool(base_path),
        car_display=car_display,
        has_reference=has_refs,
        reference_count=len(reference_paths),
        reference_context=reference_context or "",
    )))

    # Build conversation log for inspection
    full_prompt = build_prompt(
        prompt,
        mode=mode,
        has_wireframe=bool(wireframe_path),
        has_base=bool(base_path),
        car_display=car_display,
        has_reference=has_refs,
        reference_count=len(reference_paths),
        reference_context=reference_context or "",
    )
    
    conversation_log = {
        "user_prompt": prompt,
        "mode": mode,
        "model": model,
        "full_system_prompt": full_prompt,
        "images_sent": {
            "wireframe": bool(wireframe_path),
            "base_or_reference": bool(base_path or has_refs),
            "reference_count": len(reference_paths),
        },
        "model_response": None,
    }

    print(f"[generate_livery] Calling {model} …")
    # Determine resolution: Pro always uses 2K, Flash respects the parameter
    resolution = "2K" if (model == MODEL_PRO or resolution_2k) else "1K"
    print(f"[generate_livery] Resolution: {resolution}")
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
            image_config=types.ImageConfig(
                image_size=resolution,
            ),
        ),
    )

    # Extract the image from the response
    # part.inline_data.data is raw bytes; load into Pillow directly
    # (part.as_image() returns the SDK's own Image type, not PIL)
    generated_image: Image.Image | None = None

    # Guard against empty / blocked responses
    if not response.candidates:
        reason = getattr(response, "prompt_feedback", None)
        raise RuntimeError(
            f"Model returned no candidates. Prompt may have been blocked. Feedback: {reason}"
        )

    candidate = response.candidates[0]
    finish = getattr(candidate, "finish_reason", None)

    if candidate.content is None or candidate.content.parts is None:
        raise RuntimeError(
            f"Model returned no content (finish_reason={finish}). "
            "The prompt may have been blocked by safety filters or the model quota is exhausted."
        )

    for part in candidate.content.parts:
        if part.inline_data is not None:
            generated_image = Image.open(io.BytesIO(part.inline_data.data))
            generated_image.load()  # fully decode before the BytesIO goes out of scope
            break
        if part.text:
            print(f"[model] {part.text}")
            conversation_log["model_response"] = part.text

    if generated_image is None:
        raise RuntimeError(
            f"No image was returned by the model (finish_reason={finish}). "
            "Check your API key, quota, and prompt content."
        )

    print(f"[generate_livery] Raw image size from model: {generated_image.size}")

    # Upscale with Real-ESRGAN, or fall back to simple Lanczos resize
    upscale_succeeded = False
    if upscale:
        try:
            from server.upscale import upscale_to_2048, is_available
            if is_available():
                print("[generate_livery] Running Real-ESRGAN upscale …")
                generated_image = upscale_to_2048(generated_image)
                upscale_succeeded = True
                print("[generate_livery] Real-ESRGAN upscale succeeded")
            else:
                print("[generate_livery] WARNING: upscale requested but Real-ESRGAN not available — falling back to Lanczos")
                if generated_image.size != (2048, 2048):
                    generated_image = generated_image.resize((2048, 2048), Image.LANCZOS)
        except Exception as e:
            print(f"[generate_livery] ERROR: Upscale failed ({e}) — falling back to Lanczos resize (livery will be saved with non-upscaled metadata)")
            if generated_image.size != (2048, 2048):
                generated_image = generated_image.resize((2048, 2048), Image.LANCZOS)
    else:
        if generated_image.size != (2048, 2048):
            print(f"[generate_livery] Resizing from {generated_image.size} to 2048×2048 …")
            generated_image = generated_image.resize((2048, 2048), Image.LANCZOS)

    # Save as .tga (iRacing format)
    output_path = str(output_path)
    if not output_path.lower().endswith(".tga"):
        output_path += ".tga"

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    generated_image.save(output_path, format="TGA")
    print(f"[generate_livery] Saved → {output_path}")
    return output_path, conversation_log, upscale_succeeded


# ─── Specular map generation ──────────────────────────────────────────────────

def build_specular_prompt(
    user_prompt: str,
    has_wireframe: bool = True,
    has_livery: bool = False,
) -> str:
    """Build the prompt for generating a specular/reflective map."""

    # ── Wireframe block ──────────────────────────────────────────────────────
    wireframe_block = ""
    if has_wireframe:
        wireframe_block = """IMAGE 1 — UV WIREFRAME (structural guide only):
This image shows the UV layout and panel boundaries of the car. Use it ONLY to determine where each surface area (roof, doors, bonnet, bumpers, tyres, etc.) is located in UV space. Do NOT copy any visual content from this image.""".strip()

    # ── Livery reference block ────────────────────────────────────────────────
    livery_block = ""
    if has_livery:
        livery_block = f"""IMAGE {'2' if has_wireframe else '1'} — LIVERY TEXTURE (material reference):
This is the car's colour livery texture. Use it ONLY as a reference to identify which areas are painted panels, window glass, rubber tyres, carbon fibre, metal trim, etc. Do NOT copy the colours or graphics — only use it to distinguish material regions for the specular map.""".strip()

    # ── Task block ───────────────────────────────────────────────────────────
    task_block = """TASK — GENERATE UV SPECULAR / REFLECTIVITY MAP:
You are generating a MATERIAL PROPERTY MAP — not a colour image. This map encodes surface reflectivity and shininess information across the car's UV layout.

Specular map channel encoding:
- RED channel   → Specular intensity (how much light the surface reflects): bright white = highly reflective, black = non-reflective
- GREEN channel → Gloss / roughness (sharpness of reflection): bright = glossy mirror-like, dark = diffuse/matte
- BLUE channel  → Clearcoat layer presence: bright white = clearcoat (painted panels), dark/black = no clearcoat (rubber, bare metal)

Material guide for typical racing cars:
- Painted bodywork panels (doors, roof, bonnet, bumpers): R=200–240, G=200–230, B=220–255 (high specular, glossy, clearcoat)
- Window glass: R=180–220, G=200–240, B=50–80 (reflective, very glossy, no clearcoat)
- Rubber tyres (black cutout areas): R=10–30, G=10–20, B=0–10 (near zero — absorbs light)
- Carbon fibre / weave areas: R=80–120, G=60–100, B=30–60 (moderate spec, semi-gloss, no clearcoat)
- Bare metal trim / exhausts: R=160–200, G=120–160, B=20–50 (metallic spec, no clearcoat)
- Decal / sponsor areas: same underlying material spec as panel beneath, not altered by the decal
- Matte paint / satin livery areas: R=100–160, G=60–100, B=160–200 (reduced gloss but still clearcoated)""".strip()

    # ── Technical block ───────────────────────────────────────────────────────
    technical_block = """TECHNICAL REQUIREMENTS (non-negotiable):
- Output format: flat UV texture map, exactly 2048 × 2048 pixels, square (1:1 aspect ratio)
- This is a DATA MAP — there must be NO visible 3D shading, lighting bakes, gradients from imagined light sources, or decorative effects
- Colour transitions between material zones should follow UV panel boundaries cleanly — use the wireframe to define the edges
- Black background / wheel arches / glass cutout regions: R=0, G=0, B=0 (no reflectivity at all)
- No drop shadows, no glows, no artistic interpretation — this is a technical material mask
- Do NOT include any background, studio floor, car 3D model, mockup frame, or scene context — output the raw texture map ONLY""".strip()

    # ── Assemble ─────────────────────────────────────────────────────────────
    parts = ["You are a technical artist generating a UV specular/reflectivity map for an iRacing car livery.\n"]
    if wireframe_block:
        parts.append(wireframe_block)
    if livery_block:
        parts.append(livery_block)
    parts.append(task_block)
    parts.append(technical_block)
    parts.append(f"SPECULAR MAP INSTRUCTION:\n{user_prompt}")

    if has_wireframe:
        parts.append("""FINAL REMINDER — UV STRUCTURE IS MANDATORY:
Re-examine the wireframe image before placing any values. Every material zone boundary in your output must align with the panel boundaries shown in the wireframe. The material transitions must follow the UV layout exactly.""".strip())

    return "\n\n".join(parts)


def generate_spec_map(
    prompt: str,
    wireframe_path: str,
    output_path: str,
    livery_path: str | None = None,
    model: str = MODEL_FAST,
    api_key: str | None = None,
    resolution_2k: bool = True,
) -> tuple[str, dict]:
    """Generate a specular map using Gemini and save it as a TGA file.

    Returns (output_path, conversation_log).
    """
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("No Gemini API key provided.")

    client = genai.Client(api_key=api_key)

    has_wireframe = bool(wireframe_path and Path(wireframe_path).exists())
    has_livery = bool(livery_path and Path(livery_path).exists())

    full_prompt = build_specular_prompt(
        user_prompt=prompt,
        has_wireframe=has_wireframe,
        has_livery=has_livery,
    )

    # ── Build contents list ──────────────────────────────────────────────────
    contents: list = []
    if has_wireframe:
        wire_bytes = load_image_as_bytes(wireframe_path)
        wire_mime = get_image_mime_type(wireframe_path)
        contents.append(types.Part.from_bytes(data=wire_bytes, mime_type=wire_mime))

    if has_livery:
        livery_bytes = load_image_as_bytes(livery_path)
        livery_mime = get_image_mime_type(livery_path)
        contents.append(types.Part.from_bytes(data=livery_bytes, mime_type=livery_mime))

    contents.append(full_prompt)

    conversation_log = {
        "full_system_prompt": full_prompt,
        "images_sent": {
            "wireframe": has_wireframe,
            "livery": has_livery,
        },
        "model_response": None,
    }

    print(f"[generate_spec_map] Calling {model} …")
    resolution = "2K" if (model == MODEL_PRO or resolution_2k) else "1K"
    print(f"[generate_spec_map] Resolution: {resolution}")

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
            image_config=types.ImageConfig(image_size=resolution),
        ),
    )

    if not response.candidates:
        reason = getattr(response, "prompt_feedback", None)
        raise RuntimeError(f"Model returned no candidates. Feedback: {reason}")

    candidate = response.candidates[0]
    finish = getattr(candidate, "finish_reason", None)

    if candidate.content is None or candidate.content.parts is None:
        raise RuntimeError(
            f"Model returned no content (finish_reason={finish}). "
            "The prompt may have been blocked or quota exhausted."
        )

    generated_image: Image.Image | None = None
    for part in candidate.content.parts:
        if part.inline_data is not None:
            generated_image = Image.open(io.BytesIO(part.inline_data.data))
            generated_image.load()
            break
        if part.text:
            print(f"[model] {part.text}")
            conversation_log["model_response"] = part.text

    if generated_image is None:
        raise RuntimeError(
            f"No image returned by model (finish_reason={finish}). "
            "Check API key, quota, and prompt content."
        )

    print(f"[generate_spec_map] Raw image size from model: {generated_image.size}")

    # Resize to 2048×2048 (no Real-ESRGAN for spec maps — preserve data fidelity)
    if generated_image.size != (2048, 2048):
        print(f"[generate_spec_map] Resizing from {generated_image.size} to 2048×2048 …")
        generated_image = generated_image.resize((2048, 2048), Image.LANCZOS)

    output_path = str(output_path)
    if not output_path.lower().endswith(".tga"):
        output_path += ".tga"

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    generated_image.save(output_path, format="TGA")
    print(f"[generate_spec_map] Saved → {output_path}")
    return output_path, conversation_log


# ─── CLI entry point ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Generate an iRacing livery with Gemini")
    parser.add_argument("--prompt",      required=True, help="Livery description")
    parser.add_argument("--wireframe",   required=True, help="Path to UV wireframe PNG")
    parser.add_argument("--output",      required=True, help="Output .tga path")
    parser.add_argument("--base",        default=None,  help="Optional base diffuse PNG")
    parser.add_argument("--model",       default=MODEL_PRO, choices=[MODEL_PRO, MODEL_FAST],
                        help="Which Gemini model to use")
    parser.add_argument("--api-key",     default=None,  help="Gemini API key (or set GEMINI_API_KEY env var)")
    parser.add_argument("--mode",        default="new",  choices=["new", "modify", "iterate"],
                        help="Generation mode: 'new' for a fresh livery, 'modify' to change an existing one, 'iterate' to refine a previous generation")
    args = parser.parse_args()

    generate_livery(
        prompt=args.prompt,
        wireframe_path=args.wireframe,
        output_path=args.output,
        base_path=args.base,
        model=args.model,
        api_key=args.api_key,
        mode=args.mode,
    )


if __name__ == "__main__":
    main()

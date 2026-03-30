"""
server/routes/api_generate.py
------------------------------
/api/generate         — full Gemini livery generation
/api/enhance-prompt   — improve a user prompt via Gemini text
/api/sponsors         — apply sponsor logos to an existing livery
/api/spending         — GET spending log entries
/api/spending/record  — POST a failed/cancelled transaction
"""

from __future__ import annotations

import base64
import datetime
import io
import json
import os
import re
import shutil
import tempfile
from pathlib import Path

from flask import Blueprint, jsonify, request

from server.config import get_data_dir, get_liveries_dir, get_thumbnails_dir, get_user_cars_dir, load_config, save_config
from server.cars import lookup_car_display
from server.extract import LIBRARY_DIR, LIBRARY_ROOT
import server.spending as spending_log

bp = Blueprint("api_generate", __name__)

# Modes that use their own fixed wireframe/diffuse from /library/<mode>/
GEAR_MODES = {"helmet", "suit"}


# ── Path resolution helpers ───────────────────────────────────────────────────

_LIBRARY_URL_RE = re.compile(r"^/api/library/image/([a-z0-9_-]+)/(wire\.jpg|diffuse\.jpg)$")
_GEAR_URL_RE    = re.compile(r"^/api/library/(helmet|suit)/(wire\.jpg|diffuse\.jpg)$")


def _resolve_image_path(path_or_url: str) -> str:
    """Resolve a library image URL (e.g. /api/library/image/slug/wire.jpg
    or /api/library/helmet/wire.jpg) to an absolute filesystem path.
    Non-URL paths are returned unchanged."""
    if not path_or_url:
        return path_or_url
    # Helmet / suit library assets
    gm = _GEAR_URL_RE.match(path_or_url)
    if gm:
        gear_type, filename = gm.group(1), gm.group(2)
        return str(LIBRARY_ROOT / gear_type / filename)
    # Car library assets
    m = _LIBRARY_URL_RE.match(path_or_url)
    if not m:
        return path_or_url
    slug, filename = m.group(1), m.group(2)
    # Check user cars first, then library (same order as the serving endpoint)
    for base in (get_user_cars_dir(), LIBRARY_DIR):
        candidate = base / slug / filename
        if candidate.exists():
            return str(candidate)
    # Fallback: return library path even if it doesn't exist (will fail validation later)
    return str(LIBRARY_DIR / slug / filename)


# ── Recent-car helper ─────────────────────────────────────────────────────────

def _record_recent_car(folder: str, config: dict | None = None) -> None:
    """Prepend *folder* to the recent-cars list (max 5) and persist to config."""
    if config is None:
        config = load_config()
    recents: list[dict] = config.get("recent_cars", [])
    display = lookup_car_display(folder)
    recents = [r for r in recents if r.get("folder") != folder]
    recents.insert(0, {"folder": folder, "display": display})
    config["recent_cars"] = recents[:5]
    save_config(config)


# ── Generate ──────────────────────────────────────────────────────────────────

@bp.route("/api/generate", methods=["POST"])
def api_generate():
    """Generate a livery image via Gemini and optionally deploy to iRacing."""
    from server.generate import generate_livery, MODEL_PRO, MODEL_FAST
    from server.deploy import deploy_livery, deploy_gear, resolve_car_folder
    from PIL import Image

    data   = request.json or {}
    config = load_config()

    prompt              = data.get("prompt", "").strip()
    wireframe_path      = _resolve_image_path(
                            data.get("wireframe_path",   config.get("default_wireframe",    "")).strip())
    base_texture_path   = _resolve_image_path(
                            data.get("base_texture_path", config.get("default_base_texture", "")).strip())
    # Accept both "reference_image_paths" (legacy) and "reference_paths" (React frontend)
    reference_image_paths = data.get("reference_image_paths") or data.get("reference_paths", [])
    if not reference_image_paths:
        legacy = data.get("reference_image_path", "").strip()
        if legacy:
            reference_image_paths = [legacy]
    reference_image_paths = [p for p in reference_image_paths if p and Path(p).exists()]
    reference_context   = data.get("reference_context", "").strip()
    # Accept both "model" (React frontend: 'flash'/'pro') and "use_fast_model" (legacy)
    model_param         = data.get("model", "").strip().lower() or ("flash" if data.get("use_fast_model", config.get("use_fast_model", False)) else "pro")
    use_fast            = model_param == "flash"
    resolution_2k       = data.get("resolution_2k", True)
    # Accept both "car_name" (legacy) and "car_folder" (React frontend)
    car_name            = (data.get("car_name") or data.get("car_folder") or config.get("default_car", "")).strip()
    customer_id         = data.get("customer_id",      config.get("customer_id", "")).strip()
    auto_deploy         = data.get("auto_deploy", True)
    mode                = data.get("mode", "new")
    upscale             = data.get("upscale_result", False) and mode not in ("raw", *GEAR_MODES)
    is_gear             = mode in GEAR_MODES  # helmet / suit

    # Helmet / suit: auto-resolve wire + diffuse from /library/<mode>/
    if is_gear:
        gear_wire = LIBRARY_ROOT / mode / "wire.jpg"
        gear_diff = LIBRARY_ROOT / mode / "diffuse.jpg"
        wireframe_path    = str(gear_wire) if gear_wire.exists() else ""
        if not base_texture_path:
            base_texture_path = str(gear_diff) if gear_diff.exists() else ""
        # Gear items auto-deploy to paint root (if customer_id is set)
        # Don't auto-deploy if customer_id is missing
        if not customer_id:
            auto_deploy = False

    api_key = config.get("gemini_api_key", "") or os.environ.get("GEMINI_API_KEY", "")

    print(f"[GENERATE] prompt={prompt[:50]}")
    print(f"[GENERATE] wireframe_path={wireframe_path}")
    print(f"[GENERATE] base_texture_path={base_texture_path}")
    print(f"[GENERATE] mode={mode}, car_name={car_name}, auto_deploy={auto_deploy}")

    # Validation
    if not prompt:
        return jsonify({"error": "Please enter a livery description."}), 400
    if mode not in ("raw", *GEAR_MODES) and not wireframe_path:
        return jsonify({"error": "Please select a wireframe image."}), 400
    if mode not in ("raw", *GEAR_MODES) and wireframe_path and not Path(wireframe_path).exists():
        return jsonify({"error": f"Wireframe not found: {wireframe_path}"}), 400
    if is_gear and wireframe_path and not Path(wireframe_path).exists():
        return jsonify({"error": f"{mode.title()} wireframe not found — check /library/{mode}/wire.jpg"}), 400
    if not api_key:
        return jsonify({"error": "No Gemini API key set. Go to Settings to add one."}), 400
    if auto_deploy and not is_gear and not car_name:
        return jsonify({"error": "Please select a car for deployment."}), 400
    if auto_deploy and not customer_id:
        auto_deploy = False

    try:
        model       = MODEL_FAST if use_fast else MODEL_PRO
        car_display = mode.title() if is_gear else lookup_car_display(car_name)
        print(f"[GENERATE] Using model: {model} (use_fast={use_fast}, model_param={model_param})")
        liveries_dir = get_liveries_dir()
        liveries_dir.mkdir(parents=True, exist_ok=True)

        with tempfile.NamedTemporaryFile(suffix=".tga", delete=False,
                                         dir=tempfile.gettempdir()) as tmp:
            tmp_path = tmp.name

        result = generate_livery(
            prompt=prompt,
            wireframe_path=wireframe_path if mode not in ("raw",) else "",
            output_path=tmp_path,
            base_path=base_texture_path or None,
            reference_paths=reference_image_paths or None,
            reference_context=reference_context or None,
            model=model,
            api_key=api_key,
            mode=mode,
            car_display=car_display,
            upscale=upscale,
            resolution_2k=resolution_2k if use_fast else True,
        )

        # Unpack result: (output_path, conversation_log, upscale_succeeded)
        if isinstance(result, tuple) and len(result) >= 3:
            result_path, conversation_log, upscale_succeeded = result[0], result[1], result[2]
        elif isinstance(result, tuple) and len(result) == 2:
            result_path, conversation_log = result
            upscale_succeeded = False
        else:
            result_path = result
            conversation_log = None
            upscale_succeeded = False

        response: dict = {
            "status":     "ok",
            "generated_path": result_path,
            "model_used": "Gemini Flash" if use_fast else "Gemini Pro",
        }

        # ── Archive ───────────────────────────────────────────────────────────
        ts          = datetime.datetime.now()
        date_prefix = ts.strftime("%Y%m%d_%H%M%S")
        safe_name   = re.sub(r"[^\w\-]", "_", prompt[:50])
        livery_name = f"{date_prefix}_{safe_name}.tga"
        livery_path = liveries_dir / livery_name
        shutil.copy2(result_path, livery_path)
        response["archive_path"] = str(livery_path)
        response["livery_path"]  = str(livery_path)

        # Full-quality JPG
        try:
            Image.open(result_path).convert("RGB").save(
                str(livery_path.with_suffix(".jpg")), format="JPEG", quality=92
            )
        except Exception as e:
            print(f"[GENERATE] Warning: full JPG failed: {e}")

        # Thumbnail preview JPG (stored in internal .thumbnails dir)
        try:
            thumb_dir = get_thumbnails_dir()
            preview_jpg_path = thumb_dir / (livery_path.stem + "_preview.jpg")
            thumb = Image.open(result_path).convert("RGB")
            thumb.thumbnail((512, 512))
            thumb.save(str(preview_jpg_path), format="JPEG", quality=85)
        except Exception as e:
            print(f"[GENERATE] Warning: preview JPG failed: {e}")

        # ── Sidecar JSON ──────────────────────────────────────────────────────
        cfg_prices    = load_config()
        model_name    = "Flash" if use_fast else "Pro"
        resolution_str = "2K" if (use_fast and resolution_2k) or not use_fast else "1K"
        pricing_map   = {
            ("Flash", "1K"): cfg_prices.get("price_flash_1k", 0.067),
            ("Flash", "2K"): cfg_prices.get("price_flash_2k", 0.101),
            ("Pro",   "2K"): cfg_prices.get("price_pro",      0.134),
            ("Pro",   "1K"): cfg_prices.get("price_pro",      0.134),
        }
        estimated_cost = pricing_map.get((model_name, resolution_str),
                                         cfg_prices.get("price_pro", 0.134))

        sidecar: dict = {
            "prompt":               prompt,
            "mode":                 mode,
            "model":                model_name,
            "resolution":           resolution_str,
            "estimated_cost":       estimated_cost,
            "wireframe_path":       wireframe_path,
            "base_texture_path":    base_texture_path or "",
            "reference_image_paths": reference_image_paths or [],
            "reference_context":    reference_context or "",
            "car":                  car_display if not is_gear else "",
            "car_folder":           car_name if not is_gear else "",
            "customer_id":          customer_id,
            "auto_deploy":          auto_deploy,
            "upscaled":             upscale_succeeded,
            "generated_at":         ts.isoformat(timespec="seconds"),
            "api_requests":         1,
        }
        if conversation_log:
            sidecar["conversation_log"] = conversation_log

        livery_path.with_suffix(".json").write_text(
            json.dumps(sidecar, indent=2), encoding="utf-8"
        )

        # ── Record to persistent spending log ─────────────────────────────────
        spending_log.record(
            cost=estimated_cost,
            model=model_name,
            resolution=resolution_str,
            status="success",
            car=mode.title() if is_gear else (car_display or car_name),
            livery_id=livery_path.stem,
            estimated=False,
        )

        # ── Link iteration back to its source livery ──────────────────────────
        # When mode is modify/iterate and base_texture_path points to a livery
        # in history, record source_livery_path on this sidecar and append this
        # livery to the source's iterations[] list (mirrors spec_maps[] logic).
        if mode in ("modify", "iterate") and base_texture_path:
            source_path = Path(base_texture_path).resolve()
            matched = False
            for json_file in get_liveries_dir().glob("*.json"):
                if json_file.resolve() == livery_path.with_suffix(".json").resolve():
                    continue  # skip our own sidecar
                try:
                    entry = json.loads(json_file.read_text(encoding="utf-8"))
                    entry_livery = entry.get("livery_path") or str(json_file.with_suffix(".tga"))
                    if Path(entry_livery).resolve() == source_path:
                        # Patch the source's sidecar with an iterations[] entry
                        iterations: list = entry.get("iterations", [])
                        if str(livery_path) not in iterations:
                            iterations.append(str(livery_path))
                        entry["iterations"] = iterations
                        json_file.write_text(json.dumps(entry, indent=2), encoding="utf-8")
                        # Patch our own sidecar with source_livery_path
                        sidecar["source_livery_path"] = str(source_path)
                        livery_path.with_suffix(".json").write_text(
                            json.dumps(sidecar, indent=2), encoding="utf-8"
                        )
                        print(f"[GENERATE] Linked iteration to source livery: {json_file.name}")
                        matched = True
                        break
                except Exception as link_err:
                    print(f"[GENERATE] Warning: could not patch sidecar {json_file.name}: {link_err}")
            if not matched:
                print(f"[GENERATE] No matching source livery found for base_texture_path={base_texture_path!r}")

        # ── Deploy ────────────────────────────────────────────────────────────
        if auto_deploy and customer_id:
            if is_gear:
                dest = deploy_gear(tga_path=result_path, gear_type=mode,
                                    customer_id=customer_id)
                response["deployed_to"] = str(dest)
            elif car_name:
                dest = deploy_livery(tga_path=result_path, car_name=car_name,
                                      customer_id=customer_id)
                response["deployed_to"] = str(dest)
                response["car_folder"]  = resolve_car_folder(car_name)
                _record_recent_car(car_name, config)
        elif not is_gear and car_name:
            _record_recent_car(car_name, config)

        # ── Preview PNG ───────────────────────────────────────────────────────
        img     = Image.open(result_path).convert("RGBA")
        preview = img.copy()
        preview.thumbnail((512, 512))
        buf = io.BytesIO()
        preview.save(buf, format="PNG")
        response["preview_b64"] = base64.b64encode(buf.getvalue()).decode()
        print(f"[GENERATE] preview PNG size: {len(response['preview_b64'])} chars")

        # ── Enrich response with sidecar fields for the frontend detail panel ──
        response["prompt"]            = prompt
        response["context"]           = reference_context or ""
        response["mode"]              = mode
        response["cost"]              = estimated_cost
        response["car"]               = car_display or car_name
        response["model_name"]        = model_name
        response["resolution"]        = resolution_str
        if conversation_log:
            response["conversation_log"] = conversation_log

        # ── Cleanup temp file ─────────────────────────────────────────────────
        try:
            Path(result_path).unlink(missing_ok=True)
            if result_path != tmp_path:
                Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass

        return jsonify(response)

    except Exception as e:
        import traceback
        traceback.print_exc()
        
        # Extract error details for frontend error modal
        error_message = str(e)
        error_code = None
        
        # Check for Gemini API errors (ServerError with helpful message)
        if "503" in error_message or "UNAVAILABLE" in error_message:
            error_code = 503
            # Extract the user-friendly message from Google API error
            try:
                if hasattr(e, 'response_json') and isinstance(e.response_json, dict):
                    api_msg = e.response_json.get('error', {}).get('message', '')
                    if api_msg:
                        error_message = api_msg
            except Exception:
                pass
        
        response = {"error": error_message}
        if error_code:
            response["error_code"] = error_code
        
        return jsonify(response), 500


# ── Spending log endpoints ─────────────────────────────────────────────────────

@bp.route("/api/spending", methods=["GET"])
def api_spending():
    """Return all spending log entries (newest first)."""
    return jsonify(spending_log.get_all())


@bp.route("/api/spending/record", methods=["POST"])
def api_spending_record():
    """Record a failed or cancelled transaction from the frontend."""
    d = request.json or {}
    entry = spending_log.record(
        cost=float(d.get("cost", 0)),
        model=d.get("model", "Flash"),
        resolution=d.get("resolution", "1K"),
        status=d.get("status", "cancelled"),
        car=d.get("car", ""),
        livery_id="",
        estimated=True,
    )
    return jsonify(entry)
# ── Enhance prompt ────────────────────────────────────────────────────────────

DEFAULT_ENHANCE_GUIDANCE = """- Add specific colour references (e.g. "deep metallic navy #1a2b4f" instead of just "blue")
- Specify exact placement of graphics (hood, doors, roof, rear bumper, side skirts, etc.)
- Add realistic racing livery details the user may not have mentioned (number roundels, pinstripes, fade transitions, sponsor placement areas)
- Describe surface finishes (matte, satin, gloss, metallic, carbon fibre pattern)
- Include realistic racing design conventions (contrasting number backgrounds, panel-aligned colour breaks)
- Keep the user's original creative intent — enhance and flesh out, don't contradict
- Keep it concise but detailed — aim for 3-6 sentences"""


@bp.route("/api/enhance-guidance", methods=["GET"])
def get_enhance_guidance():
    """Return the current enhance guidance (user override or default)."""
    config = load_config()
    guidance = config.get("enhance_guidance", "").strip() or DEFAULT_ENHANCE_GUIDANCE.strip()
    return jsonify({"guidance": guidance, "default": DEFAULT_ENHANCE_GUIDANCE.strip()})


@bp.route("/api/enhance-guidance", methods=["POST"])
def set_enhance_guidance():
    """Save custom enhance guidance to config."""
    data = request.json or {}
    guidance = data.get("guidance", "").strip()
    from server.config import load_config, save_config
    config = load_config()
    config["enhance_guidance"] = guidance
    save_config(config)
    return jsonify({"ok": True})


@bp.route("/api/enhance-prompt", methods=["POST"])
def enhance_prompt():
    """Use Gemini text model to flesh out a brief livery prompt."""
    data    = request.json or {}
    prompt  = data.get("prompt",  "").strip()
    context = data.get("context", "").strip()
    mode    = data.get("mode", "new")

    if not prompt:
        return jsonify({"error": "No prompt to enhance"}), 400

    config  = load_config()
    api_key = config.get("gemini_api_key", "") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return jsonify({"error": "No Gemini API key set. Go to Settings to add one."}), 400

    try:
        from google import genai

        client = genai.Client(api_key=api_key)

        mode_context = {
            "new":     "The user is describing a brand-new racing livery from scratch.",
            "modify":  "The user is describing modifications to an existing livery.",
            "iterate": "The user is describing iterative refinements to a previously generated livery.",
        }.get(mode, "The user is describing a racing livery.")

        # Use custom guidance from config if set, otherwise default
        custom_guidance = config.get("enhance_guidance", "").strip()
        guidelines = custom_guidance if custom_guidance else DEFAULT_ENHANCE_GUIDANCE.strip()

        system_prompt = f"""You are a professional racing livery design consultant. {mode_context}

Your job is to rewrite a user's brief livery description into a detailed, specific prompt that will produce better AI-generated racing livery textures.

CRITICAL: Your response must contain ONLY the enhanced prompt text — no preamble, no explanation, no headings, no bullet points, no commentary, no "Here is your enhanced prompt:" or similar. Just the raw prompt text itself.

Guidelines for the enhanced prompt:
{guidelines}"""

        if context:
            system_prompt += f"\n\nAdditional context provided by the user: {context}"

        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
            ),
        )
        return jsonify({"enhanced": response.text.strip(), "status": "ok"})

    except Exception as e:
        print(f"[enhance] Error: {e}")
        return jsonify({"error": f"Enhancement failed: {str(e)}"}), 500


# ── Sponsors ──────────────────────────────────────────────────────────────────

@bp.route("/api/sponsors", methods=["POST"])
def api_sponsors():
    """Place sponsor logos onto an existing livery using Gemini image generation."""
    from server.generate import MODEL_PRO, MODEL_FAST
    from server.deploy import deploy_livery
    from google import genai
    from google.genai import types
    from PIL import Image

    data   = request.json or {}
    config = load_config()

    base_texture_path = _resolve_image_path(data.get("base_texture_path", "").strip())
    sponsor_paths     = data.get("sponsor_paths", [])
    wireframe_path    = _resolve_image_path(data.get("wireframe_path", "").strip())
    reference_path    = _resolve_image_path(data.get("reference_path",  "").strip())
    notes             = data.get("notes", "").strip()
    # Accept both "model" (React frontend: 'flash'/'pro') and "use_fast_model" (legacy)
    model_param       = data.get("model", "").strip().lower() or ("flash" if data.get("use_fast_model", config.get("use_fast_model", False)) else "pro")
    use_fast          = model_param == "flash"
    car_name          = (data.get("car_name") or data.get("car_folder") or config.get("default_car", "")).strip()
    customer_id       = data.get("customer_id", config.get("customer_id",  "")).strip()
    auto_deploy       = data.get("auto_deploy", True)

    api_key = config.get("gemini_api_key", "") or os.environ.get("GEMINI_API_KEY", "")

    # Validation
    if not base_texture_path or not Path(base_texture_path).exists():
        return jsonify({"error": "Base texture file not found."}), 400
    if not sponsor_paths:
        return jsonify({"error": "Please add at least one sponsor logo file."}), 400
    missing = [p for p in sponsor_paths if not Path(p).exists()]
    if missing:
        return jsonify({"error": f"Sponsor file not found: {missing[0]}"}), 400
    if not api_key:
        return jsonify({"error": "No Gemini API key set. Go to Settings to add one."}), 400
    if auto_deploy and not car_name:
        return jsonify({"error": "Please select a car for deployment."}), 400
    if auto_deploy and not customer_id:
        return jsonify({"error": "Customer ID not set — add it in Settings."}), 400

    try:
        model_id    = MODEL_FAST if use_fast else MODEL_PRO
        car_display = lookup_car_display(car_name)

        sponsor_count = len(sponsor_paths)
        sponsor_names = [Path(p).stem for p in sponsor_paths]
        sponsor_list  = "\n".join(f"  {i+1}. {n}" for i, n in enumerate(sponsor_names))
        car_block     = f"\nCAR: {car_display}\nThis livery is for the {car_display} in iRacing.\n" if car_display else ""
        notes_block   = f"\nPLACEMENT NOTES FROM USER:\n{notes}\n" if notes else ""

        wireframe_block = ""
        if wireframe_path:
            wireframe_block = (
                "WIREFRAME REFERENCE IMAGE (first image provided) — STRUCTURAL GUIDE ONLY:\n"
                "The first image is a UV panel wireframe. "
                "CRITICAL: Do NOT reproduce the wireframe lines in the output — they must be invisible in the result. "
                "Use it only to understand panel boundaries so sponsor graphics do not bleed across seams."
            )

        reference_block = ""
        if reference_path and Path(reference_path).exists():
            reference_block = (
                "REFERENCE LIVERY IMAGE (additional image):\n"
                "Use it ONLY as loose inspiration for sponsor zones and orientation. "
                "Do NOT copy the reference design — produce a fresh, original placement."
            )

        prompt_text = f"""You are a professional motorsport livery designer applying sponsor logos to a racing car texture for iRacing simulation software.
{wireframe_block}
{reference_block}
{car_block}
TASK — APPLY SPONSOR LOGOS TO EXISTING LIVERY:
The provided base texture image is the current livery. Place the {sponsor_count} sponsor logo image(s) onto it in a professional, realistic way.

SPONSOR LOGOS PROVIDED (in order after the base texture):
{sponsor_list}

PLACEMENT RULES:
- Preserve the entire existing livery design exactly — only ADD the sponsor logos.
- Place logos in locations real racing teams use: hood, doors, rear quarter panels, front bumper, rear wing end-plates, sill area, A-pillar, roof.
- Scale each logo appropriately for its placement area.
- Ensure every logo is correctly oriented and readable from outside the car.
- Mirror door/quarter-panel logos symmetrically on both sides.
- Do NOT distort logo proportions.
- No drop shadows, no glow effects — flat, clean placement only.
{notes_block}
TECHNICAL REQUIREMENTS:
- Output: flat UV texture map, exactly 2048 × 2048 pixels (1:1 aspect ratio)
- No 3D shading, ambient occlusion, specular highlights, or lighting bakes — completely flat/unlit
- Wheel arches and window areas must remain solid black (#000000)
- Output the raw UV texture map ONLY — no background, no 3D render, no mockup frame"""

        client   = genai.Client(api_key=api_key)
        contents: list = []

        # Wireframe (optional, always first)
        if wireframe_path and Path(wireframe_path).exists():
            wf_bytes = Path(wireframe_path).read_bytes()
            wf_mime  = "image/png" if wireframe_path.lower().endswith(".png") else "image/jpeg"
            contents.append(types.Part.from_bytes(data=wf_bytes, mime_type=wf_mime))

        # Reference livery (optional)
        if reference_path and Path(reference_path).exists():
            ref_bytes = Path(reference_path).read_bytes()
            if reference_path.lower().endswith(".tga"):
                buf = io.BytesIO()
                Image.open(reference_path).convert("RGBA").save(buf, format="PNG")
                ref_bytes = buf.getvalue()
            ref_mime = "image/png" if reference_path.lower().endswith((".png", ".tga")) else "image/jpeg"
            contents.append(types.Part.from_bytes(data=ref_bytes, mime_type=ref_mime))

        # Base texture
        base_bytes = Path(base_texture_path).read_bytes()
        base_mime  = "image/png"
        if base_texture_path.lower().endswith(".tga"):
            buf = io.BytesIO()
            Image.open(base_texture_path).convert("RGBA").save(buf, format="PNG")
            base_bytes = buf.getvalue()
        elif base_texture_path.lower().endswith((".jpg", ".jpeg")):
            base_mime = "image/jpeg"
        contents.append(types.Part.from_bytes(data=base_bytes, mime_type=base_mime))

        # Sponsor logos
        for sp in sponsor_paths:
            sp_bytes = Path(sp).read_bytes()
            sp_mime  = "image/jpeg" if sp.lower().endswith((".jpg", ".jpeg")) else "image/png"
            contents.append(types.Part.from_bytes(data=sp_bytes, mime_type=sp_mime))

        contents.append(types.Part.from_text(text=prompt_text))

        print(f"[sponsors] Calling {model_id} with {sponsor_count} logo(s)…")

        conversation_log: dict = {
            "mode":          "sponsors",
            "model":         model_id,
            "sponsor_count": sponsor_count,
            "sponsor_names": sponsor_names,
            "full_system_prompt": prompt_text,
            "images_sent": {
                "wireframe":     bool(wireframe_path),
                "reference":     bool(reference_path and Path(reference_path).exists()),
                "base_texture":  True,
                "sponsor_logos": sponsor_count,
            },
            "model_response": None,
        }

        gen_response = client.models.generate_content(
            model=model_id,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
                image_config=types.ImageConfig(image_size="2K"),
            ),
        )

        if not gen_response.candidates:
            raise RuntimeError("Model returned no candidates. Prompt may have been blocked.")

        candidate = gen_response.candidates[0]
        finish    = getattr(candidate, "finish_reason", None)
        if candidate.content is None or candidate.content.parts is None:
            raise RuntimeError(
                f"Model returned no content (finish_reason={finish}). "
                "Check your API key, quota, or try different logos."
            )

        result_image: Image.Image | None = None
        for part in candidate.content.parts:
            if part.inline_data is not None:
                result_image = Image.open(io.BytesIO(part.inline_data.data))
                result_image.load()
                break
            if part.text:
                print(f"[sponsors][model] {part.text}")
                conversation_log["model_response"] = part.text

        if result_image is None:
            raise RuntimeError(
                f"No image returned by model (finish_reason={finish}). "
                "The model may have declined to process the sponsor logos."
            )

        if result_image.size != (2048, 2048):
            print(f"[sponsors] Resizing {result_image.size} → 2048×2048")
            result_image = result_image.resize((2048, 2048), Image.LANCZOS)

        # ── Archive ───────────────────────────────────────────────────────────
        liveries_dir = get_liveries_dir()
        liveries_dir.mkdir(parents=True, exist_ok=True)
        ts          = datetime.datetime.now()
        date_prefix = ts.strftime("%Y%m%d_%H%M%S")
        safe_note   = re.sub(r"[^\w\-]", "_", (notes or "sponsors")[:40])
        livery_name = f"{date_prefix}_{safe_note}_sponsored.tga"
        livery_path = liveries_dir / livery_name

        result_image.save(str(livery_path), format="TGA")
        print(f"[sponsors] Saved → {livery_path}")

        try:
            result_image.convert("RGB").save(
                str(livery_path.with_suffix(".jpg")), format="JPEG", quality=92
            )
        except Exception as je:
            print(f"[sponsors] Warning: full JPG failed: {je}")

        try:
            preview_jpg = get_thumbnails_dir() / (livery_path.stem + "_preview.jpg")
            thumb = result_image.copy().convert("RGB")
            thumb.thumbnail((512, 512))
            thumb.save(str(preview_jpg), format="JPEG", quality=85)
        except Exception as pje:
            print(f"[sponsors] Warning: preview JPG failed: {pje}")

        cfg_prices     = load_config()
        sponsors_model = "Flash" if use_fast else "Pro"
        sponsors_cost  = (cfg_prices.get("price_flash_2k", 0.101) if use_fast
                          else cfg_prices.get("price_pro", 0.134))

        sidecar: dict = {
            "prompt":           notes or "(sponsor placement)",
            "mode":             "sponsors",
            "model":            sponsors_model,
            "resolution":       "2K",
            "estimated_cost":   sponsors_cost,
            "base_texture_path": base_texture_path,
            "wireframe_path":   wireframe_path,
            "sponsor_paths":    sponsor_paths,
            "car":              car_display or car_name,
            "car_folder":       car_name,
            "customer_id":      customer_id,
            "auto_deploy":      auto_deploy,
            "upscaled":         False,
            "generated_at":     ts.isoformat(timespec="seconds"),
            "api_requests":     1,
            "conversation_log": conversation_log,
        }
        livery_path.with_suffix(".json").write_text(
            json.dumps(sidecar, indent=2), encoding="utf-8"
        )

        resp: dict = {
            "status":       "ok",
            "archive_path": str(livery_path),
            "livery_path":  str(livery_path),
            "model_used":   "Gemini Flash" if use_fast else "Gemini Pro",
        }

        if auto_deploy and car_name and customer_id:
            dest = deploy_livery(tga_path=str(livery_path), car_name=car_name,
                                  customer_id=customer_id)
            resp["deployed_to"] = str(dest)
            resp["car_folder"]  = car_name

        if car_name:
            _record_recent_car(car_name, config)

        preview = result_image.copy().convert("RGBA")
        preview.thumbnail((512, 512))
        buf = io.BytesIO()
        preview.save(buf, format="PNG")
        resp["preview_b64"] = base64.b64encode(buf.getvalue()).decode()

        return jsonify(resp)

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── Generate specular map ─────────────────────────────────────────────────────

@bp.route("/api/generate-specular", methods=["POST"])
def api_generate_specular():
    """Generate a specular/reflectivity map via Gemini and optionally deploy to iRacing."""
    from server.generate import generate_spec_map, MODEL_PRO, MODEL_FAST
    from server.deploy import deploy_spec_livery, resolve_car_folder
    from PIL import Image

    data   = request.json or {}
    config = load_config()

    prompt           = data.get("prompt", "").strip()
    wireframe_path   = _resolve_image_path(
                         data.get("wireframe_path", config.get("default_wireframe", "")).strip())
    livery_path_in   = _resolve_image_path(
                         data.get("livery_path", "").strip())
    # Accept both "model" (React frontend: 'flash'/'pro') and "use_fast_model" (legacy)
    model_param      = data.get("model", "").strip().lower() or ("flash" if data.get("use_fast_model", config.get("use_fast_model", False)) else "pro")
    use_fast         = model_param == "flash"
    resolution_2k    = data.get("resolution_2k", True)
    car_name         = (data.get("car_folder") or data.get("car_name") or config.get("default_car", "")).strip()
    customer_id      = data.get("customer_id", config.get("customer_id", "")).strip()
    auto_deploy      = data.get("auto_deploy", False)

    api_key = config.get("gemini_api_key", "") or os.environ.get("GEMINI_API_KEY", "")

    print(f"[SPECULAR] prompt={prompt[:50]!r}")
    print(f"[SPECULAR] wireframe={wireframe_path!r}, livery={livery_path_in!r}")

    # Validation
    if not prompt:
        return jsonify({"error": "Please enter a specular map description."}), 400
    if not api_key:
        return jsonify({"error": "No Gemini API key set. Go to Settings to add one."}), 400
    if auto_deploy and not car_name:
        return jsonify({"error": "Please select a car for deployment."}), 400
    if auto_deploy and not customer_id:
        auto_deploy = False

    # wireframe and livery are optional but warn if wireframe is missing
    if wireframe_path and not Path(wireframe_path).exists():
        return jsonify({"error": f"Wireframe not found: {wireframe_path}"}), 400
    if livery_path_in and not Path(livery_path_in).exists():
        return jsonify({"error": f"Livery file not found: {livery_path_in}"}), 400

    try:
        model        = MODEL_FAST if use_fast else MODEL_PRO
        car_display  = lookup_car_display(car_name) if car_name else ""
        liveries_dir = get_liveries_dir()
        liveries_dir.mkdir(parents=True, exist_ok=True)

        with tempfile.NamedTemporaryFile(suffix=".tga", delete=False,
                                         dir=tempfile.gettempdir()) as tmp:
            tmp_path = tmp.name

        result_path, conversation_log = generate_spec_map(
            prompt=prompt,
            wireframe_path=wireframe_path or "",
            output_path=tmp_path,
            livery_path=livery_path_in or None,
            model=model,
            api_key=api_key,
            resolution_2k=resolution_2k if use_fast else True,
        )

        response: dict = {
            "status":     "ok",
            "model_used": "Gemini Flash" if use_fast else "Gemini Pro",
        }

        # ── Archive ───────────────────────────────────────────────────────────
        ts          = datetime.datetime.now()
        date_prefix = ts.strftime("%Y%m%d_%H%M%S")
        safe_name   = re.sub(r"[^\w\-]", "_", prompt[:50])
        spec_name   = f"{date_prefix}_{safe_name}_spec.tga"
        spec_path   = liveries_dir / spec_name
        shutil.copy2(result_path, spec_path)
        response["archive_path"] = str(spec_path)
        response["livery_path"]  = str(spec_path)

        # Full-quality JPG
        try:
            Image.open(result_path).convert("RGB").save(
                str(spec_path.with_suffix(".jpg")), format="JPEG", quality=92
            )
        except Exception as e:
            print(f"[SPECULAR] Warning: full JPG failed: {e}")

        # Thumbnail preview
        try:
            thumb_dir = get_thumbnails_dir()
            preview_jpg_path = thumb_dir / (spec_path.stem + "_preview.jpg")
            thumb = Image.open(result_path).convert("RGB")
            thumb.thumbnail((512, 512))
            thumb.save(str(preview_jpg_path), format="JPEG", quality=85)
        except Exception as e:
            print(f"[SPECULAR] Warning: preview JPG failed: {e}")

        # ── Sidecar JSON ──────────────────────────────────────────────────────
        cfg_prices     = load_config()
        model_name     = "Flash" if use_fast else "Pro"
        resolution_str = "2K" if (use_fast and resolution_2k) or not use_fast else "1K"
        pricing_map    = {
            ("Flash", "1K"): cfg_prices.get("price_flash_1k", 0.067),
            ("Flash", "2K"): cfg_prices.get("price_flash_2k", 0.101),
            ("Pro",   "2K"): cfg_prices.get("price_pro",      0.134),
            ("Pro",   "1K"): cfg_prices.get("price_pro",      0.134),
        }
        estimated_cost = pricing_map.get((model_name, resolution_str),
                                          cfg_prices.get("price_pro", 0.134))

        sidecar: dict = {
            "entry_type":         "spec",
            "prompt":             prompt,
            "mode":               "spec",
            "model":              model_name,
            "resolution":         resolution_str,
            "estimated_cost":     estimated_cost,
            "wireframe_path":     wireframe_path or "",
            "source_livery_path": livery_path_in or "",
            "car":                car_display or car_name,
            "car_folder":         car_name,
            "customer_id":        customer_id,
            "auto_deploy":        auto_deploy,
            "generated_at":       ts.isoformat(timespec="seconds"),
            "api_requests":       1,
            "conversation_log":   conversation_log,
        }

        spec_path.with_suffix(".json").write_text(
            json.dumps(sidecar, indent=2), encoding="utf-8"
        )

        # ── Link spec map back to its source livery ───────────────────────────
        # Find any history sidecar whose livery path matches our source livery,
        # then append this spec path to its spec_maps array.
        if livery_path_in:
            for json_file in liveries_dir.glob("*.json"):
                if json_file.stem.endswith("_spec"):
                    continue  # don't patch other spec sidecars
                try:
                    entry = json.loads(json_file.read_text(encoding="utf-8"))
                    entry_livery = entry.get("livery_path") or str(json_file.with_suffix(".tga"))
                    if Path(entry_livery).resolve() == Path(livery_path_in).resolve():
                        spec_maps: list = entry.get("spec_maps", [])
                        if str(spec_path) not in spec_maps:
                            spec_maps.append(str(spec_path))
                        entry["spec_maps"] = spec_maps
                        json_file.write_text(json.dumps(entry, indent=2), encoding="utf-8")
                        print(f"[SPECULAR] Linked spec to livery sidecar: {json_file.name}")
                        break
                except Exception as link_err:
                    print(f"[SPECULAR] Warning: could not patch sidecar {json_file.name}: {link_err}")

        # ── Deploy ────────────────────────────────────────────────────────────
        if auto_deploy and car_name and customer_id:
            dest = deploy_spec_livery(tga_path=str(spec_path), car_name=car_name,
                                       customer_id=customer_id)
            response["deployed_to"] = str(dest)
            response["car_folder"]  = resolve_car_folder(car_name)

        if car_name:
            _record_recent_car(car_name, config)

        # ── Preview PNG ───────────────────────────────────────────────────────
        img     = Image.open(result_path).convert("RGBA")
        preview = img.copy()
        preview.thumbnail((512, 512))
        buf = io.BytesIO()
        preview.save(buf, format="PNG")
        response["preview_b64"] = base64.b64encode(buf.getvalue()).decode()

        # Enrich response
        response["prompt"]       = prompt
        response["cost"]         = estimated_cost
        response["model_name"]   = model_name
        response["resolution"]   = resolution_str
        response["entry_type"]   = "spec"
        response["conversation_log"] = conversation_log

        # Cleanup temp file
        try:
            Path(result_path).unlink(missing_ok=True)
            if result_path != tmp_path:
                Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass

        return jsonify(response)

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

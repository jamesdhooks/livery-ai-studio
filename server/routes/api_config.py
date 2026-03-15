"""
server/routes/api_config.py
---------------------------
/api/version, /api/log, /api/config, /api/session, /api/prompt-history, /api/wipe-data
"""

from __future__ import annotations

import shutil
import time
from pathlib import Path

from flask import Blueprint, jsonify, request

from server.config import DEFAULT_CONFIG, load_config, save_config, get_data_dir
from version import __version__

bp = Blueprint("api_config", __name__)

MAX_PROMPT_HISTORY = 50


# ── Version / debug ───────────────────────────────────────────────────────────

@bp.route("/api/version")
def api_version():
    return jsonify({"version": __version__})


@bp.route("/api/log", methods=["POST"])
def api_log():
    data = request.json or {}
    print(f"[JS] {data.get('msg', '')}", flush=True)
    return jsonify({"ok": True})


# ── Config ────────────────────────────────────────────────────────────────────

@bp.route("/api/config", methods=["GET"])
def get_config():
    config = load_config()
    masked = config.copy()
    if masked["gemini_api_key"]:
        key = masked["gemini_api_key"]
        masked["gemini_api_key_masked"] = key[:8] + "…" + key[-4:] if len(key) > 12 else "••••"
        masked["gemini_api_key_set"] = True
    else:
        masked["gemini_api_key_masked"] = ""
        masked["gemini_api_key_set"] = False
    del masked["gemini_api_key"]

    print("[app] Checking upscale availability…")
    try:
        from upscale import is_available as _upscale_available
        masked["upscale_available"] = _upscale_available()
    except Exception as e:
        print(f"[app] upscale check failed: {e}")
        masked["upscale_available"] = False

    return jsonify(masked)


@bp.route("/api/config", methods=["POST"])
def update_config():
    config = load_config()
    data = request.json or {}
    for key in DEFAULT_CONFIG:
        if key in data:
            config[key] = data[key]
    save_config(config)
    return jsonify({"status": "ok"})


# ── Session (persisted form state) ────────────────────────────────────────────

@bp.route("/api/session", methods=["GET"])
def get_session():
    config = load_config()
    ref_paths = config.get("reference_image_paths", [])
    if not ref_paths and config.get("reference_image_path", ""):
        ref_paths = [config["reference_image_path"]]
    return jsonify({
        "last_prompt":              config.get("last_prompt", ""),
        "last_context":             config.get("last_context", ""),
        "last_car":                 config.get("last_car", ""),
        "last_mode":                config.get("last_mode", "new"),
        "last_model":               config.get("last_model", "pro"),
        "last_is_2k":               config.get("last_is_2k", False),
        "last_auto_enhance":        config.get("last_auto_enhance", False),
        "reference_context":        config.get("reference_context", ""),
        "wireframe_path":           config.get("wireframe_path", ""),
        "base_texture_path":        config.get("base_texture_path", ""),
        "reference_image_paths":    ref_paths,
        "sponsors_base_path":       config.get("sponsors_base_path", ""),
        "sponsors_wireframe_path":  config.get("sponsors_wireframe_path", ""),
        "sponsors_reference_path":  config.get("sponsors_reference_path", ""),
        "upscale_preference":       config.get("upscale_preference", False),
    })


@bp.route("/api/session", methods=["POST"])
def save_session():
    data = request.json or {}
    config = load_config()
    fields = [
        "last_prompt", "last_context", "last_car", "last_mode",
        "last_model", "last_is_2k", "last_auto_enhance", "reference_context",
        "wireframe_path", "base_texture_path", "reference_image_path",
        "reference_image_paths", "sponsors_base_path",
        "sponsors_wireframe_path", "sponsors_reference_path", "upscale_preference",
    ]
    for field in fields:
        if field in data:
            config[field] = data[field]
    save_config(config)
    return jsonify({"ok": True})


# ── Prompt history ────────────────────────────────────────────────────────────

@bp.route("/api/prompt-history", methods=["GET"])
def get_prompt_history():
    return jsonify(load_config().get("prompt_history", []))


@bp.route("/api/prompt-history", methods=["POST"])
def add_prompt_history():
    data = request.json or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"status": "error", "message": "empty prompt"}), 400
    config = load_config()
    history = [h for h in config.get("prompt_history", []) if h.get("prompt") != prompt]
    history.insert(0, {"prompt": prompt, "timestamp": int(time.time() * 1000)})
    config["prompt_history"] = history[:MAX_PROMPT_HISTORY]
    save_config(config)
    return jsonify({"status": "ok"})


# ── Per-car wireframe/base overrides ──────────────────────────────────────────

@bp.route("/api/car-override/<car_folder>", methods=["GET"])
def get_car_override(car_folder: str):
    """
    Return the stored wire/base override paths for a car, validating each file
    still exists on disk. Missing files are stripped and the fallback (empty
    string) is returned so the frontend can fall back to the library default.
    """
    config = load_config()
    overrides: dict = config.get("car_overrides", {}).get(car_folder, {})

    wire = overrides.get("wire", "")
    base = overrides.get("base", "")

    # Validate — clear if file gone
    needs_save = False
    if wire and not Path(wire).exists():
        print(f"[car-override] Wire override missing, clearing: {wire}")
        wire = ""
        needs_save = True
    if base and not Path(base).exists():
        print(f"[car-override] Base override missing, clearing: {base}")
        base = ""
        needs_save = True

    if needs_save:
        all_overrides = config.get("car_overrides", {})
        entry = all_overrides.get(car_folder, {})
        if not wire:
            entry.pop("wire", None)
        if not base:
            entry.pop("base", None)
        if entry:
            all_overrides[car_folder] = entry
        else:
            all_overrides.pop(car_folder, None)
        config["car_overrides"] = all_overrides
        save_config(config)

    return jsonify({"car_folder": car_folder, "wire": wire, "base": base})


@bp.route("/api/car-override/<car_folder>", methods=["POST"])
def set_car_override(car_folder: str):
    """
    Persist wire and/or base override paths for a specific car.
    Pass null/empty string for a field to clear that override.
    Only fields present in the request body are updated.
    """
    data = request.json or {}
    config = load_config()
    all_overrides: dict = config.get("car_overrides", {})
    entry: dict = all_overrides.get(car_folder, {})

    for field in ("wire", "base"):
        if field in data:
            val = (data[field] or "").strip()
            if val:
                entry[field] = val
            else:
                entry.pop(field, None)

    if entry:
        all_overrides[car_folder] = entry
    else:
        all_overrides.pop(car_folder, None)

    config["car_overrides"] = all_overrides
    save_config(config)
    return jsonify({"status": "ok", "car_folder": car_folder, "wire": entry.get("wire", ""), "base": entry.get("base", "")})




@bp.route("/api/wipe-data", methods=["POST"])
def wipe_data():
    """Delete all generated data (liveries, uploads, history, session state).
    Preserves config.json (API key, customer ID, pricing)."""
    data = request.json or {}
    confirmation = (data.get("confirmation") or "").strip().lower()
    if confirmation != "wipe my data":
        return jsonify({"error": "Confirmation text does not match"}), 400

    data_dir = get_data_dir()
    deleted = []

    # Remove data subdirectories
    for sub in ("liveries", "uploads", "cars"):
        target = data_dir / sub
        if target.exists() and target.is_dir():
            shutil.rmtree(str(target), ignore_errors=True)
            deleted.append(str(target))

    # Remove history file
    history_file = data_dir / "history.json"
    if history_file.exists():
        history_file.unlink()
        deleted.append(str(history_file))

    # Clear session state from config (preserve API key, customer ID, pricing)
    config = load_config()
    session_keys = [
        "last_prompt", "last_context", "last_car", "last_mode", "last_model",
        "wireframe_path", "base_texture_path", "reference_image_path",
        "reference_image_paths", "sponsors_base_path",
        "sponsors_wireframe_path", "sponsors_reference_path",
        "upscale_preference", "prompt_history", "car_overrides",
    ]
    for key in session_keys:
        if key in config:
            if isinstance(config[key], list):
                config[key] = []
            elif isinstance(config[key], bool):
                config[key] = False
            else:
                config[key] = ""
    save_config(config)

    print(f"[wipe] Deleted: {deleted}")
    return jsonify({"status": "ok", "deleted": deleted})

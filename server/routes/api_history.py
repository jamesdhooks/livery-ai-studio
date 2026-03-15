"""
server/routes/api_history.py
----------------------------
/api/history         — list generated liveries
/api/history/delete  — delete a livery
/api/history-detail  — return sidecar JSON
/api/deploy          — copy TGA to iRacing paint folder
/api/clear-paint     — remove car_<id>.tga from iRacing
/api/upscale         — Real-ESRGAN upscale
/api/preview         — base64 PNG preview of a TGA
/api/preview-jpg     — base64 of an existing preview JPG
/api/image-data      — full-resolution base64 PNG
"""

from __future__ import annotations

import base64
import io
import json
import shutil
from pathlib import Path

from flask import Blueprint, jsonify, request

from server.config import get_data_dir, get_liveries_dir, get_thumbnails_dir, load_config
from server.deploy import deploy_livery, get_iracing_paint_dir, resolve_car_folder

bp = Blueprint("api_history", __name__)


# ── History ───────────────────────────────────────────────────────────────────

@bp.route("/api/history", methods=["GET"])
def api_history():
    liveries_dir = get_liveries_dir()
    if not liveries_dir.exists():
        return jsonify([])

    files = sorted(liveries_dir.glob("*.tga"), key=lambda f: f.stat().st_mtime, reverse=True)
    items = []
    for f in files[:100]:
        if f.stem.endswith("_upscaled"):
            continue
        item: dict = {
            "name":     f.stem.replace("_", " "),
            "filename": f.name,
            "path":     str(f),
            "modified": f.stat().st_mtime,
        }
        # Look for preview JPG: first in .thumbnails (new), then legacy location next to TGA
        thumb_dir = get_thumbnails_dir()
        preview_jpg = thumb_dir / (f.stem + "_preview.jpg")
        if not preview_jpg.exists():
            legacy_preview = f.with_name(f.stem + "_preview.jpg")
            if legacy_preview.exists():
                # Migrate legacy preview to .thumbnails
                try:
                    shutil.move(str(legacy_preview), str(preview_jpg))
                except Exception:
                    preview_jpg = legacy_preview  # fallback: use in-place
        if preview_jpg.exists():
            item["preview_jpg"] = str(preview_jpg)
        upscaled_tga = f.with_name(f.stem + "_upscaled.tga")
        if upscaled_tga.exists():
            item["upscaled"]      = True
            item["upscaled_path"] = str(upscaled_tga)

        sidecar = f.with_suffix(".json")
        if sidecar.exists():
            try:
                meta = json.loads(sidecar.read_text(encoding="utf-8"))
                for key in ("prompt", "mode", "model", "car", "car_folder", "customer_id",
                            "wireframe_path", "base_texture_path", "auto_deploy",
                            "api_requests", "estimated_cost", "cost_breakdown",
                            "conversation_log", "generated_at"):
                    item[key] = meta.get(key)
                if meta.get("upscaled"):
                    item["upscaled"] = True
            except Exception:
                pass
        items.append(item)
        if len(items) >= 50:
            break
    return jsonify(items)


@bp.route("/api/history/delete", methods=["POST"])
def api_history_delete():
    data     = request.json or {}
    tga_path = data.get("path", "").strip()
    if not tga_path:
        return jsonify({"error": "No path provided"}), 400
    p = Path(tga_path)
    if not p.exists():
        return jsonify({"error": "File not found"}), 404
    try:
        p.resolve().relative_to(get_liveries_dir().resolve())
    except ValueError:
        return jsonify({"error": "Cannot delete files outside the liveries directory"}), 403

    deleted = []
    for suffix in (".tga", ".json", ".jpg"):
        f = p.with_suffix(suffix)
        if f.exists():
            f.unlink(); deleted.append(f.name)
    for extra in (p.with_name(p.stem + "_preview.jpg"), p.with_name(p.stem + "_upscaled.tga")):
        if extra.exists():
            extra.unlink(); deleted.append(extra.name)
    # Clean up thumbnail in .thumbnails dir
    try:
        thumb = get_thumbnails_dir() / (p.stem + "_preview.jpg")
        if thumb.exists():
            thumb.unlink(); deleted.append(thumb.name)
    except Exception:
        pass
    return jsonify({"status": "ok", "deleted": deleted})


@bp.route("/api/history-detail", methods=["POST"])
def api_history_detail():
    data     = request.json or {}
    tga_path = data.get("path", "").strip()
    if not tga_path:
        return jsonify({"error": "No path provided"}), 400
    sidecar = Path(tga_path).with_suffix(".json")
    if not sidecar.exists():
        return jsonify({"error": "No sidecar JSON found", "raw": {}})
    try:
        return jsonify({"raw": json.loads(sidecar.read_text(encoding="utf-8"))})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Deploy ────────────────────────────────────────────────────────────────────

@bp.route("/api/deploy", methods=["POST"])
def api_deploy():
    data        = request.json or {}
    tga_path    = data.get("path", "").strip()
    car_name    = data.get("car_folder", "").strip()
    customer_id = data.get("customer_id", "").strip()

    if not tga_path:
        return jsonify({"error": "No TGA path provided"}), 400
    if not Path(tga_path).exists():
        return jsonify({"error": f"TGA file not found: {tga_path}"}), 404
    if not car_name:
        return jsonify({"error": "No car folder specified"}), 400

    config = load_config()
    customer_id = customer_id or config.get("customer_id", "").strip()
    if not customer_id:
        return jsonify({"error": "No customer ID — set it in Settings"}), 400

    try:
        dest = deploy_livery(tga_path=tga_path, car_name=car_name, customer_id=customer_id)
        return jsonify({"status": "ok", "deployed_to": str(dest)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/clear-paint", methods=["POST"])
def api_clear_paint():
    data        = request.json or {}
    paint_type  = data.get("type", "texture")
    car_folder  = data.get("car_folder", "").strip()
    customer_id = data.get("customer_id", "").strip()

    config = load_config()
    customer_id = customer_id or config.get("customer_id", "").strip()
    if not car_folder:
        return jsonify({"error": "No car selected"}), 400
    if not customer_id:
        return jsonify({"error": "No customer ID — set it in Settings"}), 400

    paint_dir = get_iracing_paint_dir(resolve_car_folder(car_folder))
    filename  = f"car_spec_{customer_id}.tga" if paint_type == "spec" else f"car_{customer_id}.tga"
    target    = paint_dir / filename

    if not target.exists():
        return jsonify({"status": "ok", "message": f"{filename} does not exist"})
    try:
        target.unlink()
        return jsonify({"status": "ok", "deleted": str(target)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/deploy-default", methods=["POST"])
def api_deploy_default():
    """Deploy the car library's default diffuse texture as the livery."""
    from PIL import Image as PILImage

    data        = request.json or {}
    car_folder  = data.get("car_folder", "").strip()
    customer_id = data.get("customer_id", "").strip()

    config = load_config()
    customer_id = customer_id or config.get("customer_id", "").strip()
    if not car_folder:
        return jsonify({"error": "No car selected"}), 400
    if not customer_id:
        return jsonify({"error": "No customer ID — set it in Settings"}), 400

    # Find the diffuse texture in the car library
    from server.cars import find_car_dir
    car_dir = find_car_dir(car_folder)
    if not car_dir:
        return jsonify({"error": f"Car folder not found: {car_folder}"}), 404
    diffuse = car_dir / "diffuse.jpg"
    if not diffuse.exists():
        return jsonify({"error": "No default diffuse texture found for this car"}), 404

    try:
        img = PILImage.open(diffuse).convert("RGBA")
        paint_dir = get_iracing_paint_dir(resolve_car_folder(car_folder))
        paint_dir.mkdir(parents=True, exist_ok=True)
        dest = paint_dir / f"car_{customer_id}.tga"
        img.save(str(dest), format="TGA")
        return jsonify({"status": "ok", "deployed_to": str(dest)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Upscale ───────────────────────────────────────────────────────────────────

@bp.route("/api/upscale", methods=["POST"])
def api_upscale():
    from PIL import Image

    data        = request.json or {}
    source_path = data.get("path", "").strip()

    if not source_path or not Path(source_path).exists():
        return jsonify({"error": "Source file not found"}), 404

    try:
        from upscale import upscale_to_2048, is_available
        if not is_available():
            return jsonify({"error": "Real-ESRGAN is not available. See README for setup."}), 400

        print(f"[upscale] Loading {source_path}")
        upscaled = upscale_to_2048(Image.open(source_path))

        src     = Path(source_path)
        out_name = src.name if src.stem.endswith("_upscaled") else src.stem + "_upscaled.tga"
        out_path = src.parent / out_name
        upscaled.save(str(out_path), format="TGA")
        print(f"[upscale] Saved → {out_path}")

        # Update sidecar
        try:
            original_stem = src.stem.replace("_upscaled", "")
            sidecar_path  = src.parent / (original_stem + ".json")
            if sidecar_path.exists():
                meta = json.loads(sidecar_path.read_text(encoding="utf-8"))
                meta["upscaled"]      = True
                meta["upscaled_path"] = str(out_path)
                sidecar_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception as sc_err:
            print(f"[upscale] Warning: couldn't update sidecar: {sc_err}")

        preview = upscaled.copy().convert("RGBA")
        preview.thumbnail((512, 512))
        buf = io.BytesIO()
        preview.save(buf, format="PNG")

        return jsonify({
            "status":       "ok",
            "output_path":  str(out_path),
            "preview_b64":  base64.b64encode(buf.getvalue()).decode(),
            "size":         list(upscaled.size),
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── Preview helpers ───────────────────────────────────────────────────────────

@bp.route("/api/preview", methods=["POST"])
def api_preview():
    from PIL import Image
    data = request.json or {}
    path = data.get("path", "")
    full = data.get("full", False)
    if not path or not Path(path).exists():
        return jsonify({"error": "File not found"}), 404
    try:
        img = Image.open(path)
        if not full:
            img = img.copy(); img.thumbnail((512, 512))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return jsonify({"preview_b64": base64.b64encode(buf.getvalue()).decode()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/preview-jpg", methods=["POST"])
def api_preview_jpg():
    data = request.json or {}
    path = data.get("path", "")
    if not path or not Path(path).exists():
        return jsonify({"error": "File not found"}), 404
    try:
        with open(path, "rb") as f:
            return jsonify({"preview_b64": base64.b64encode(f.read()).decode()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/image-data", methods=["POST"])
def api_image_data():
    from PIL import Image
    data = request.json or {}
    path = data.get("path", "")
    if not path or not Path(path).exists():
        return jsonify({"error": "File not found"}), 404
    try:
        buf = io.BytesIO()
        Image.open(path).save(buf, format="PNG")
        return jsonify({"base64": base64.b64encode(buf.getvalue()).decode()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

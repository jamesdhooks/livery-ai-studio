"""
server/routes/api_history.py
----------------------------
/api/history              — list generated liveries (excludes trash)
/api/history/delete       — move a livery to trash
/api/history/trash        — list trashed liveries
/api/history/trash/move   — move selected liveries to trash
/api/history/trash/restore — restore a trashed livery
/api/history/trash/restore-many — restore multiple trashed liveries
/api/history/trash/purge  — permanently delete a trashed livery
/api/history/trash/clear  — permanently delete ALL trash
/api/history/trash/count  — count trashed liveries
/api/history-detail       — return sidecar JSON
/api/deploy               — copy TGA to iRacing paint folder
/api/clear-paint          — remove car_<id>.tga from iRacing
/api/upscale              — Real-ESRGAN upscale
/api/resample             — SeedVR2 diffusion resample
/api/preview              — base64 PNG preview of a TGA
/api/preview-jpg          — base64 of an existing preview JPG
/api/image-data           — full-resolution base64 PNG
"""

from __future__ import annotations

import base64
import io
import json
import shutil
import time
from pathlib import Path

from flask import Blueprint, jsonify, request

from server.config import get_data_dir, get_liveries_dir, get_thumbnails_dir, load_config
from server.deploy import deploy_livery, deploy_spec_livery, deploy_gear, get_iracing_paint_dir, resolve_car_folder

TRASH_RETENTION_SECONDS = 86_400  # 1 day


def get_trash_dir() -> Path:
    """Return (and create) the trash directory under the data dir."""
    d = get_data_dir() / "trash"
    d.mkdir(parents=True, exist_ok=True)
    return d

bp = Blueprint("api_history", __name__)


# ── Livery linking helper ─────────────────────────────────────────────────────

def link_to_source(
    child_path: Path,
    child_sidecar: dict,
    source_path_str: str,
    *,
    back_link_key: str = "upscaled_versions",
) -> None:
    """
    Bidirectional link: writes ``source_livery_path`` on the child sidecar
    and appends the child's path to the source sidecar's ``back_link_key`` list.

    Parameters
    ----------
    child_path       : The child livery's .tga Path.
    child_sidecar    : The child sidecar dict (will be mutated in-place).
    source_path_str  : Absolute path string to the source .tga.
    back_link_key    : Key on the source sidecar to append the child path to.
    """
    liveries_dir = get_liveries_dir()
    source_path  = Path(source_path_str).resolve()

    # 1. Forward link on child
    child_sidecar["source_livery_path"] = str(source_path)

    # 2. Back link on source sidecar
    for json_file in liveries_dir.glob("*.json"):
        if json_file.resolve() == child_path.with_suffix(".json").resolve():
            continue  # skip our own sidecar
        try:
            entry = json.loads(json_file.read_text(encoding="utf-8"))
            entry_livery = entry.get("livery_path") or str(json_file.with_suffix(".tga"))
            if Path(entry_livery).resolve() == source_path:
                links: list = entry.get(back_link_key, [])
                if str(child_path) not in links:
                    links.append(str(child_path))
                entry[back_link_key] = links
                json_file.write_text(json.dumps(entry, indent=2), encoding="utf-8")
                print(f"[link] Linked {child_path.name} → {json_file.name} [{back_link_key}]")
                break
        except Exception as link_err:
            print(f"[link] Warning: could not patch {json_file.name}: {link_err}")


# ── History ───────────────────────────────────────────────────────────────────

@bp.route("/api/history", methods=["GET"])
def api_history():
    """
    Scans liveries_dir for .json sidecar files (source of truth).
    For each sidecar, resolves the associated TGA and preview thumbnail.
    Items without a sidecar (orphaned TGAs) are also included as bare entries.
    Trashed items (those with a trash_date in their sidecar) are excluded.
    """
    liveries_dir = get_liveries_dir()
    if not liveries_dir.exists():
        return jsonify([])

    thumb_dir = get_thumbnails_dir()

    def resolve_preview(stem):
        """Find the best available preview jpg for a given file stem."""
        # New location: .thumbnails/<stem>_preview.jpg
        thumb = thumb_dir / (stem + "_preview.jpg")
        if thumb.exists():
            return str(thumb)
        # Legacy: next to TGA
        legacy = liveries_dir / (stem + "_preview.jpg")
        if legacy.exists():
            # Migrate to thumbnails dir
            try:
                shutil.move(str(legacy), str(thumb))
                return str(thumb)
            except Exception:
                return str(legacy)
        return None

    seen_stems = set()
    raw_items = []

    # ── Primary pass: scan all .json sidecars ────────────────────────────────
    for sidecar in liveries_dir.glob("*.json"):
        stem = sidecar.stem
        seen_stems.add(stem)

        try:
            meta = json.loads(sidecar.read_text(encoding="utf-8"))
        except Exception:
            meta = {}

        # Skip trashed items — they live in the trash flow
        if meta.get("trash_date"):
            continue

        # Resolve matching TGA (stem.tga)
        tga = liveries_dir / (stem + ".tga")
        mtime = tga.stat().st_mtime if tga.exists() else sidecar.stat().st_mtime

        item: dict = {
            "name":        stem.replace("_", " "),
            "filename":    tga.name if tga.exists() else stem,
            "path":        str(tga) if tga.exists() else None,
            "livery_path": str(tga) if tga.exists() else None,
            "modified":    mtime,
        }

        # Merge all known meta fields
        for key in ("prompt", "mode", "model", "car", "car_folder", "customer_id",
                    "wireframe_path", "base_texture_path", "auto_deploy",
                    "api_requests", "estimated_cost", "cost_breakdown",
                    "conversation_log", "generated_at", "entry_type",
                    "source_livery_path", "source_path",
                    "spec_maps", "iterations", "upscaled_versions",
                    "upscaled", "upscale_engine", "resampled", "resample_engine",
                    "resolution_2k"):
            if key in meta:
                item[key] = meta[key]

        # Preview thumbnail
        preview = resolve_preview(stem)
        if preview:
            item["preview_jpg"] = preview

        raw_items.append(item)

    # ── Secondary pass: orphaned TGAs with no sidecar ───────────────────────
    for tga in liveries_dir.glob("*.tga"):
        if tga.stem in seen_stems:
            continue
        item = {
            "name":        tga.stem.replace("_", " "),
            "filename":    tga.name,
            "path":        str(tga),
            "livery_path": str(tga),
            "modified":    tga.stat().st_mtime,
        }
        preview = resolve_preview(tga.stem)
        if preview:
            item["preview_jpg"] = preview
        raw_items.append(item)

    # Sort by mtime descending, cap at 100
    raw_items.sort(key=lambda x: x.get("modified", 0), reverse=True)
    return jsonify(raw_items[:100])


@bp.route("/api/history/update", methods=["POST"])
def api_history_update():
    """Update fields on a history sidecar JSON (e.g. car_folder, car)."""
    data     = request.json or {}
    tga_path = data.get("path", "").strip()
    updates  = data.get("updates", {})

    if not tga_path:
        return jsonify({"error": "No path provided"}), 400
    sidecar = Path(tga_path).with_suffix(".json")
    if not sidecar.exists():
        return jsonify({"error": "No sidecar JSON found"}), 404

    # Safety: only allow updating whitelisted fields
    allowed = {"car", "car_folder"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        return jsonify({"error": "No valid fields to update"}), 400

    try:
        sidecar.resolve().relative_to(get_liveries_dir().resolve())
    except ValueError:
        return jsonify({"error": "Cannot modify files outside the liveries directory"}), 403

    try:
        entry = json.loads(sidecar.read_text(encoding="utf-8"))
        entry.update(filtered)
        sidecar.write_text(json.dumps(entry, indent=2), encoding="utf-8")
        return jsonify({"status": "ok", "updated": filtered})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/history/delete", methods=["POST"])
def api_history_delete():
    """Move one livery to trash (sets trash_date in sidecar, moves files to trash dir)."""
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
        return jsonify({"error": "Cannot trash files outside the liveries directory"}), 403

    return _move_to_trash(p)


def _move_to_trash(tga_path: Path):
    """Move a livery (and its sidecar + thumbnail) into the trash folder."""
    trash_dir = get_trash_dir()
    stem      = tga_path.stem
    moved     = []
    trash_date = time.time()

    # Move TGA + associated files
    for suffix in (".tga", ".json", ".jpg"):
        f = tga_path.with_suffix(suffix)
        if f.exists():
            dest = trash_dir / f.name
            shutil.move(str(f), str(dest))
            moved.append(f.name)

    for extra in (tga_path.with_name(stem + "_preview.jpg"),
                  tga_path.with_name(stem + "_upscaled.tga")):
        if extra.exists():
            dest = trash_dir / extra.name
            shutil.move(str(extra), str(dest))
            moved.append(extra.name)

    # Move thumbnail
    try:
        thumb = get_thumbnails_dir() / (stem + "_preview.jpg")
        if thumb.exists():
            dest = trash_dir / thumb.name
            shutil.move(str(thumb), str(dest))
            moved.append(thumb.name)
    except Exception:
        pass

    # Update (or create) sidecar in trash with trash_date
    sidecar_in_trash = trash_dir / (stem + ".json")
    try:
        if sidecar_in_trash.exists():
            meta = json.loads(sidecar_in_trash.read_text(encoding="utf-8"))
        else:
            meta = {}
        meta["trash_date"] = trash_date
        sidecar_in_trash.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"[trash] Warning: couldn't update sidecar: {e}")

    return jsonify({"status": "ok", "moved": moved})


# ── Trash API ─────────────────────────────────────────────────────────────────

@bp.route("/api/history/trash/move", methods=["POST"])
def api_history_trash_move():
    """Move multiple liveries to trash."""
    data  = request.json or {}
    paths = data.get("paths", [])
    if not paths:
        return jsonify({"error": "No paths provided"}), 400

    liveries_dir = get_liveries_dir()
    results = []
    for tga_path_str in paths:
        p = Path(tga_path_str.strip())
        if not p.exists():
            results.append({"path": tga_path_str, "error": "File not found"})
            continue
        try:
            p.resolve().relative_to(liveries_dir.resolve())
        except ValueError:
            results.append({"path": tga_path_str, "error": "Outside liveries directory"})
            continue
        _move_to_trash(p)
        results.append({"path": tga_path_str, "status": "ok"})

    return jsonify({"status": "ok", "results": results})


@bp.route("/api/history/trash", methods=["GET"])
def api_history_trash():
    """Return all trashed liveries."""
    trash_dir = get_trash_dir()

    items = []
    for sidecar in trash_dir.glob("*.json"):
        stem = sidecar.stem
        try:
            meta = json.loads(sidecar.read_text(encoding="utf-8"))
        except Exception:
            meta = {}

        tga = trash_dir / (stem + ".tga")
        mtime = tga.stat().st_mtime if tga.exists() else sidecar.stat().st_mtime

        item: dict = {
            "name":        stem.replace("_", " "),
            "filename":    tga.name if tga.exists() else stem,
            "path":        str(tga) if tga.exists() else str(sidecar),
            "livery_path": str(tga) if tga.exists() else None,
            "modified":    mtime,
            "trash_date":  meta.get("trash_date", mtime),
        }

        for key in ("prompt", "mode", "model", "car", "car_folder", "display_name",
                    "estimated_cost", "generated_at", "entry_type", "resolution_2k"):
            if key in meta:
                item[key] = meta[key]

        # Thumbnail — check trash dir first, then thumbnails dir
        thumb = trash_dir / (stem + "_preview.jpg")
        if thumb.exists():
            item["preview_jpg"] = str(thumb)
        else:
            thumb2 = get_thumbnails_dir() / (stem + "_preview.jpg")
            if thumb2.exists():
                item["preview_jpg"] = str(thumb2)

        if "preview_jpg" in item:
            item["preview_url"] = f'/api/uploads/preview?path={item["preview_jpg"]}'

        items.append(item)

    items.sort(key=lambda x: x.get("trash_date", 0), reverse=True)
    return jsonify(items)


@bp.route("/api/history/trash/count", methods=["GET"])
def api_history_trash_count():
    """Return the number of trashed items."""
    trash_dir = get_trash_dir()
    count = sum(1 for _ in trash_dir.glob("*.json"))
    return jsonify({"count": count})


@bp.route("/api/history/trash/restore", methods=["POST"])
def api_history_trash_restore():
    """Restore a single trashed livery back to liveries_dir."""
    data     = request.json or {}
    tga_path = data.get("path", "").strip()
    if not tga_path:
        return jsonify({"error": "No path provided"}), 400
    p = Path(tga_path)
    if not p.parent.resolve() == get_trash_dir().resolve():
        # Accept paths that may point to either TGA or JSON in trash
        p = get_trash_dir() / Path(tga_path).name
    return _restore_from_trash(p)


@bp.route("/api/history/trash/restore-many", methods=["POST"])
def api_history_trash_restore_many():
    """Restore multiple trashed liveries back to liveries_dir."""
    data  = request.json or {}
    paths = data.get("paths", [])
    if not paths:
        return jsonify({"error": "No paths provided"}), 400

    results = []
    for path_str in paths:
        p = Path(path_str.strip())
        resp_data = _restore_item(p)
        results.append(resp_data)

    return jsonify({"status": "ok", "results": results})


def _restore_item(p: Path) -> dict:
    """Restore helper — returns a result dict."""
    trash_dir    = get_trash_dir()
    liveries_dir = get_liveries_dir()
    liveries_dir.mkdir(parents=True, exist_ok=True)

    stem = p.stem
    moved = []

    for suffix in (".tga", ".json", ".jpg"):
        f = trash_dir / (stem + suffix)
        if f.exists():
            dest = liveries_dir / f.name
            shutil.move(str(f), str(dest))
            moved.append(f.name)

    for extra_name in (stem + "_preview.jpg", stem + "_upscaled.tga"):
        f = trash_dir / extra_name
        if f.exists():
            dest = liveries_dir / f.name
            shutil.move(str(f), str(dest))
            moved.append(f.name)

    # Remove trash_date from sidecar
    sidecar = liveries_dir / (stem + ".json")
    if sidecar.exists():
        try:
            meta = json.loads(sidecar.read_text(encoding="utf-8"))
            meta.pop("trash_date", None)
            sidecar.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"[trash] Warning: couldn't update sidecar on restore: {e}")

    return {"path": str(p), "status": "ok", "moved": moved}


def _restore_from_trash(p: Path):
    """Move a trashed item back to liveries and return a Flask response."""
    trash_dir = get_trash_dir()
    if not (trash_dir / (p.stem + ".tga")).exists() and not (trash_dir / (p.stem + ".json")).exists():
        return jsonify({"error": "Item not found in trash"}), 404
    result = _restore_item(p)
    return jsonify(result)


@bp.route("/api/history/trash/purge", methods=["POST"])
def api_history_trash_purge():
    """Permanently delete a single trashed livery."""
    data     = request.json or {}
    tga_path = data.get("path", "").strip()
    if not tga_path:
        return jsonify({"error": "No path provided"}), 400

    trash_dir = get_trash_dir()
    p         = Path(tga_path)
    stem      = p.stem
    deleted   = []

    for suffix in (".tga", ".json", ".jpg"):
        f = trash_dir / (stem + suffix)
        if f.exists():
            f.unlink()
            deleted.append(f.name)

    for extra_name in (stem + "_preview.jpg", stem + "_upscaled.tga"):
        f = trash_dir / extra_name
        if f.exists():
            f.unlink()
            deleted.append(f.name)

    return jsonify({"status": "ok", "deleted": deleted})


@bp.route("/api/history/trash/clear", methods=["POST"])
def api_history_trash_clear():
    """Permanently delete ALL items in trash."""
    trash_dir = get_trash_dir()
    deleted   = []

    for f in trash_dir.iterdir():
        try:
            f.unlink()
            deleted.append(f.name)
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
    tga_path    = (data.get("path") or "").strip()
    car_name    = (data.get("car_folder") or "").strip()
    customer_id = (data.get("customer_id") or "").strip()

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


@bp.route("/api/deploy-spec", methods=["POST"])
def api_deploy_spec():
    """Deploy a specular map TGA to iRacing as car_spec_<id>.tga."""
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
        dest = deploy_spec_livery(tga_path=tga_path, car_name=car_name, customer_id=customer_id)
        return jsonify({"status": "ok", "deployed_to": str(dest)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/deploy-gear", methods=["POST"])
def api_deploy_gear():
    """Deploy a helmet or suit TGA to the iRacing paint root folder.
    Saves as helmet_<customer_id>.tga or suit_<customer_id>.tga.
    """
    data        = request.json or {}
    tga_path    = (data.get("path") or "").strip()
    gear_type   = (data.get("gear_type") or "").strip().lower()
    customer_id = (data.get("customer_id") or "").strip()

    if not tga_path:
        return jsonify({"error": "No TGA path provided"}), 400
    if not Path(tga_path).exists():
        return jsonify({"error": f"TGA file not found: {tga_path}"}), 404
    if gear_type not in ("helmet", "suit"):
        return jsonify({"error": "gear_type must be 'helmet' or 'suit'"}), 400

    config = load_config()
    customer_id = customer_id or config.get("customer_id", "").strip()
    if not customer_id:
        return jsonify({"error": "No customer ID — set it in Settings"}), 400

    try:
        dest = deploy_gear(tga_path=tga_path, gear_type=gear_type, customer_id=customer_id)
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
    """Upscale directly to 2048×2048 using the configured engine (no downres step)."""
    from PIL import Image
    from server.config import load_config

    data        = request.json or {}
    source_path = (data.get("path") or "").strip()

    if not source_path or not Path(source_path).exists():
        return jsonify({"error": "Source file not found"}), 404

    config = load_config()
    engine = config.get("upscale_engine", "realesrgan")

    try:
        print(f"[upscale] Loading {source_path} (engine={engine})")
        image = Image.open(source_path)

        if engine == "seedvr2":
            from server.seedvr2 import upscale_direct, is_available as seedvr2_available
            if not seedvr2_available():
                return jsonify({"error": "SeedVR2 is not installed. Re-launch with start.bat --seedvr"}), 400
            use_gguf = config.get("seedvr2_use_gguf", True)
            use_multi_gpu = config.get("seedvr2_multi_gpu", False)
            result_image = upscale_direct(image, use_gguf=use_gguf, use_multi_gpu=use_multi_gpu)
        else:
            from server.upscale import upscale_to_2048, is_available as realesrgan_available
            if not realesrgan_available():
                return jsonify({"error": "Real-ESRGAN is not installed. Re-launch with start.bat --realesrgan"}), 400
            result_image = upscale_to_2048(image)

        src           = Path(source_path)
        liveries_dir  = get_liveries_dir()
        liveries_dir.mkdir(parents=True, exist_ok=True)
        
        # Save to liveries directory (so it shows in history)
        out_name = src.stem.replace("_upscaled", "").replace("_resampled", "") + "_upscaled.tga"
        out_path = liveries_dir / out_name
        result_image.save(str(out_path), format="TGA")
        print(f"[upscale] Saved → {out_path}")

        # Create sidecar — inherit metadata from source if available
        try:
            sidecar_path = liveries_dir / (out_path.stem + ".json")
            
            # Start with inherited metadata from source sidecar
            meta = {}
            source_sidecar = src.with_suffix(".json")
            if source_sidecar.exists():
                try:
                    source_meta = json.loads(source_sidecar.read_text(encoding="utf-8"))
                    # Inherit key fields (skip entry_type — we set our own)
                    for key in ("prompt", "mode", "model", "car", "car_folder", "customer_id",
                                "display_name", "conversation_log", "generated_at",
                                "resolution_2k"):
                        if key in source_meta:
                            meta[key] = source_meta[key]
                except Exception as e:
                    print(f"[upscale] Warning: couldn't read source sidecar: {e}")
            
            # Add upscale-specific metadata
            meta["entry_type"]     = "upscale"
            meta["upscaled"]       = True
            meta["upscale_engine"] = engine
            meta["source_path"]    = str(src)  # legacy compat

            # Bidirectional link to source livery
            link_to_source(
                child_path=out_path,
                child_sidecar=meta,
                source_path_str=str(src),
                back_link_key="upscaled_versions",
            )
            
            sidecar_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception as sc_err:
            print(f"[upscale] Warning: couldn't create sidecar: {sc_err}")

        # Save thumbnail preview JPG to thumbnails dir (for history cards)
        try:
            thumb_dir = get_thumbnails_dir()
            thumb_dir.mkdir(parents=True, exist_ok=True)
            thumb = result_image.copy().convert("RGB")
            thumb.thumbnail((512, 512))
            thumb.save(str(thumb_dir / (out_path.stem + "_preview.jpg")), format="JPEG", quality=85)
        except Exception as th_err:
            print(f"[upscale] Warning: couldn't save thumbnail: {th_err}")

        # Generate full-res base64 PNG for display
        full_res_png = result_image.copy().convert("RGBA")
        full_buf = io.BytesIO()
        full_res_png.save(full_buf, format="PNG")
        full_buf.seek(0)  # Reset buffer position before reading
        full_res_b64 = base64.b64encode(full_buf.getvalue()).decode()

        # Generate preview (512px)
        preview = result_image.copy().convert("RGBA")
        preview.thumbnail((512, 512))
        prev_buf = io.BytesIO()
        preview.save(prev_buf, format="PNG")
        prev_buf.seek(0)  # Reset buffer position before reading

        return jsonify({
            "status":       "ok",
            "output_path":  str(out_path),
            "preview_b64":  base64.b64encode(prev_buf.getvalue()).decode(),
            "full_res_b64": full_res_b64,
            "size":         list(result_image.size),
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        
        # Check for VRAM exhaustion errors
        error_str = str(e)
        if "OutOfMemoryError" in error_str or "out of memory" in error_str or "Allocation on device" in error_str:
            return jsonify({
                "error": "Out of VRAM (Video Memory). Lower the resolution, download the GGUF model, or switch to ESRGAN engine.",
                "error_code": "OUT_OF_VRAM"
            }), 500
        
        return jsonify({"error": str(e)}), 500


# ── Resample ─────────────────────────────────────────────────────────────────

@bp.route("/api/resample", methods=["POST"])
def api_resample():
    """
    Resample: downscale → optional noise → upscale → optional final downscale.

    Request body (all optional except ``path``):
        path            str   — absolute source path
        downsample_size int   — size to downscale to before upscaling (default 1024)
        upsample_size   int   — target upscale size (default 2048)
        final_2k        bool  — if True and upsample_size > 2048, downsample result to 2048
        add_noise       bool  — if True, add noise to the downscaled image before upscaling
        noise_amount    float — 0–100 noise strength (default 0)
    """
    import numpy as np
    from PIL import Image
    from server.config import load_config
    from server.upscale import _resize_aspect_aware

    data        = request.json or {}
    source_path = (data.get("path") or "").strip()

    if not source_path or not Path(source_path).exists():
        return jsonify({"error": "Source file not found"}), 404

    config = load_config()
    engine = config.get("upscale_engine", "realesrgan")

    # ── Parameters ────────────────────────────────────────────────────────────
    downsample_size = int(data.get("downsample_size", 1024))
    upsample_size   = int(data.get("upsample_size",   2048))
    final_2k        = bool(data.get("final_2k",       False))
    add_noise       = bool(data.get("add_noise",       False))
    noise_amount    = float(data.get("noise_amount",   0.0))

    # Clamp to sane values
    VALID_SIZES = {128, 256, 512, 1024, 2048, 4096}
    downsample_size = downsample_size if downsample_size in VALID_SIZES else 1024
    upsample_size   = upsample_size   if upsample_size   in VALID_SIZES else 2048
    noise_amount    = max(0.0, min(100.0, noise_amount))

    try:
        print(f"[resample] Loading {source_path} (engine={engine}, down={downsample_size}, up={upsample_size}, noise={noise_amount if add_noise else 'off'}, final_2k={final_2k})")
        image = Image.open(source_path).convert("RGBA")

        # ── Step 1: Downscale ─────────────────────────────────────────────────
        downscaled = _resize_aspect_aware(image, downsample_size)
        print(f"[resample] Downscaled to {downsample_size}px (longest side)")

        # ── Step 2: Add noise (optional) ──────────────────────────────────────
        noised_b64 = None
        if add_noise and noise_amount > 0:
            # Convert noise_amount (0–100) to a sigma for Gaussian noise.
            # At 100%, sigma = 25 (≈10% of 255), which is visually strong but not destructive.
            sigma = (noise_amount / 100.0) ** 1.5 * 25.0
            arr = np.array(downscaled, dtype=np.float32)
            noise = np.random.normal(0, sigma, arr.shape).astype(np.float32)
            # Only apply noise to RGB channels, leave alpha untouched
            arr[:, :, :3] = np.clip(arr[:, :, :3] + noise[:, :, :3], 0, 255)
            downscaled = Image.fromarray(arr.astype(np.uint8), "RGBA")
            print(f"[resample] Applied Gaussian noise sigma={sigma:.2f}")

            # Save noised downscaled image as base64 for frontend display
            noised_buf = io.BytesIO()
            noised_thumb = downscaled.copy()
            noised_thumb.thumbnail((512, 512))
            noised_thumb.save(noised_buf, format="PNG")
            noised_buf.seek(0)
            noised_b64 = base64.b64encode(noised_buf.getvalue()).decode()

        # Save the downscaled (possibly noised) input for reference alongside result
        src           = Path(source_path)
        liveries_dir  = get_liveries_dir()
        liveries_dir.mkdir(parents=True, exist_ok=True)
        out_stem      = src.stem.replace("_resampled", "").replace("_upscaled", "") + "_resampled"

        noised_path = None
        if add_noise and noise_amount > 0:
            noised_path = liveries_dir / (out_stem + "_noised_input.png")
            downscaled.save(str(noised_path), format="PNG")
            print(f"[resample] Saved noised input → {noised_path}")

        # ── Step 3: Upscale ───────────────────────────────────────────────────
        if engine == "seedvr2":
            from server.seedvr2 import resample as seedvr2_resample, is_available as seedvr2_available
            if not seedvr2_available():
                return jsonify({"error": "SeedVR2 is not installed. Re-launch with start.bat --seedvr"}), 400
            use_gguf = config.get("seedvr2_use_gguf", True)
            use_multi_gpu = config.get("seedvr2_multi_gpu", False)
            result_image = seedvr2_resample(downscaled, use_gguf=use_gguf, use_multi_gpu=use_multi_gpu, target_size=upsample_size)
        else:
            from server.upscale import resample_image, is_available as realesrgan_available
            if not realesrgan_available():
                return jsonify({"error": "Real-ESRGAN is not installed. Re-launch with start.bat --realesrgan"}), 400
            result_image = resample_image(downscaled, target_size=upsample_size)

        print(f"[resample] Upscale complete → {result_image.size}")

        # ── Step 4: Final downscale to 2K (optional) ─────────────────────────
        if final_2k and upsample_size > 2048:
            result_image = _resize_aspect_aware(result_image, 2048)
            print(f"[resample] Final downsample to 2048px (longest side)")

        # ── Save result ───────────────────────────────────────────────────────
        out_path = liveries_dir / (out_stem + ".tga")
        result_image.save(str(out_path), format="TGA")
        print(f"[resample] Saved → {out_path}")

        # Create sidecar — inherit metadata from source if available
        try:
            sidecar_path = liveries_dir / (out_path.stem + ".json")
            
            # Start with inherited metadata from source sidecar
            meta = {}
            source_sidecar = src.with_suffix(".json")
            if source_sidecar.exists():
                try:
                    source_meta = json.loads(source_sidecar.read_text(encoding="utf-8"))
                    # Inherit key fields (skip entry_type — we set our own)
                    for key in ("prompt", "mode", "model", "car", "car_folder", "customer_id",
                                "display_name", "conversation_log", "generated_at",
                                "resolution_2k"):
                        if key in source_meta:
                            meta[key] = source_meta[key]
                except Exception as e:
                    print(f"[resample] Warning: couldn't read source sidecar: {e}")
            
            # Add resample-specific metadata
            meta["entry_type"]      = "resample"
            meta["resampled"]       = True
            meta["resample_engine"] = engine
            meta["source_path"]     = str(src)  # legacy compat

            # Bidirectional link to source livery
            link_to_source(
                child_path=out_path,
                child_sidecar=meta,
                source_path_str=str(src),
                back_link_key="upscaled_versions",
            )
            meta["downsample_size"] = downsample_size
            meta["upsample_size"]  = upsample_size
            meta["final_2k"]       = final_2k
            meta["add_noise"]      = add_noise
            meta["noise_amount"]   = noise_amount
            meta["noised_input_path"] = str(noised_path) if noised_path else None
            
            sidecar_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception as sc_err:
            print(f"[resample] Warning: couldn't create sidecar: {sc_err}")

        # Save thumbnail preview JPG to thumbnails dir (for history cards)
        try:
            thumb_dir = get_thumbnails_dir()
            thumb_dir.mkdir(parents=True, exist_ok=True)
            thumb = result_image.copy().convert("RGB")
            thumb.thumbnail((512, 512))
            thumb.save(str(thumb_dir / (out_path.stem + "_preview.jpg")), format="JPEG", quality=85)
        except Exception as th_err:
            print(f"[resample] Warning: couldn't save thumbnail: {th_err}")

        # Generate full-res base64 PNG for display
        full_res_png = result_image.copy().convert("RGBA")
        full_buf = io.BytesIO()
        full_res_png.save(full_buf, format="PNG")
        full_buf.seek(0)
        full_res_b64 = base64.b64encode(full_buf.getvalue()).decode()

        # Generate preview (512px)
        preview = result_image.copy().convert("RGBA")
        preview.thumbnail((512, 512))
        prev_buf = io.BytesIO()
        preview.save(prev_buf, format="PNG")
        prev_buf.seek(0)

        response = {
            "status":       "ok",
            "output_path":  str(out_path),
            "preview_b64":  base64.b64encode(prev_buf.getvalue()).decode(),
            "full_res_b64": full_res_b64,
            "size":         list(result_image.size),
        }
        if noised_b64:
            response["noised_input_b64"] = noised_b64
        if noised_path:
            response["noised_input_path"] = str(noised_path)

        return jsonify(response)
    except Exception as e:
        import traceback; traceback.print_exc()
        
        # Check for VRAM exhaustion errors
        error_str = str(e)
        if "OutOfMemoryError" in error_str or "out of memory" in error_str or "Allocation on device" in error_str:
            return jsonify({
                "error": "Out of VRAM (Video Memory). Lower the resolution, download the GGUF model, or switch to ESRGAN engine.",
                "error_code": "OUT_OF_VRAM"
            }), 500
        
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


@bp.route("/api/extract-channels", methods=["POST"])
def api_extract_channels():
    """Extract R, G, B channels from an image and return them as individual
    grayscale JPEGs (base64-encoded, 256 px thumbnails).

    Request: { "path": "<absolute path to TGA/PNG>" }
    Response: { "r": "<base64 jpg>", "g": "<base64 jpg>", "b": "<base64 jpg>" }
    """
    from PIL import Image
    data = request.json or {}
    path = data.get("path", "")
    if not path or not Path(path).exists():
        return jsonify({"error": "File not found"}), 404

    try:
        img = Image.open(path).convert("RGB")
        r, g, b = img.split()

        result = {}
        for name, channel in [("r", r), ("g", g), ("b", b)]:
            thumb = channel.copy()
            thumb.thumbnail((256, 256))
            buf = io.BytesIO()
            thumb.save(buf, format="JPEG", quality=80)
            result[name] = base64.b64encode(buf.getvalue()).decode()

        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

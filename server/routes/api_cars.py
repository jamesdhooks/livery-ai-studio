"""
server/routes/api_cars.py
-------------------------
/api/cars        — merged car list
/api/library     — PSD extraction / car-library management
"""

from __future__ import annotations

import json
import re
import shutil
import tempfile
import threading
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory

from server.cars import (
    invalidate_cars_cache,
    list_library_cars,
    load_all_cars,
    lookup_car_display,
)
from server.config import get_user_cars_dir
from server.deploy import get_documents_folder
from server.extract import LIBRARY_DIR, extract_folder as extract_folder_batch, extract_from_zip, peek_zip

bp = Blueprint("api_cars", __name__)


# ── Cars ──────────────────────────────────────────────────────────────────────

@bp.route("/api/cars", methods=["GET"])
def list_cars():
    return jsonify(load_all_cars())


@bp.route("/api/cars/custom", methods=["POST"])
def add_custom_car():
    data = request.json or {}
    folder  = data.get("folder", "").strip()
    display = data.get("display", "").strip() or folder
    if not folder:
        return jsonify({"error": "folder is required"}), 400

    slug    = re.sub(r"[^a-z0-9]+", "_", display.lower()).strip("_") or folder
    car_dir = get_user_cars_dir() / slug
    car_dir.mkdir(parents=True, exist_ok=True)
    meta_path = car_dir / "meta.json"
    meta = {}
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            pass
    meta.update({"display_name": display, "slug": slug, "iracing_folder": folder})
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    invalidate_cars_cache()
    return jsonify({"status": "ok", "folder": folder, "display": display, "slug": slug})


@bp.route("/api/cars/custom", methods=["DELETE"])
def delete_custom_car():
    data   = request.json or {}
    folder = data.get("folder", "").strip()
    if not folder:
        return jsonify({"error": "folder is required"}), 400

    user_cars_dir = get_user_cars_dir()
    if user_cars_dir.exists():
        for meta_file in user_cars_dir.glob("*/meta.json"):
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                if meta.get("iracing_folder") == folder:
                    shutil.rmtree(meta_file.parent)
                    break
            except Exception:
                pass
    invalidate_cars_cache()
    return jsonify({"status": "ok"})


@bp.route("/api/cars/recent", methods=["GET"])
def get_recent_cars():
    from server.config import load_config
    return jsonify(load_config().get("recent_cars", []))


@bp.route("/api/cars/installed", methods=["GET"])
def list_installed_cars():
    paint_dir = get_documents_folder() / "iRacing" / "paint"
    if not paint_dir.exists():
        return jsonify([])
    return jsonify(sorted(f.name for f in paint_dir.iterdir() if f.is_dir()))


# ── Library ───────────────────────────────────────────────────────────────────

@bp.route("/api/library/cars", methods=["GET"])
def library_list_cars():
    return jsonify(list_library_cars())


# ── Import job state ──────────────────────────────────────────────────────────

_import_job: dict = {
    "running": False, "log": [], "results": [],
    "done": False, "error": None, "stop_requested": False,
}
_import_lock = threading.Lock()


def _reset_import_job() -> None:
    with _import_lock:
        _import_job.update(running=True, log=[], results=[], done=False, error=None, stop_requested=False)


def _append_log(msg: str) -> None:
    with _import_lock:
        _import_job["log"].append(msg)


def _append_result(result: dict) -> None:
    with _import_lock:
        _import_job["results"].append(result)


def _should_stop() -> bool:
    with _import_lock:
        return _import_job["stop_requested"]


@bp.route("/api/library/import/status", methods=["GET"])
def library_import_status():
    with _import_lock:
        return jsonify({
            "running":  _import_job["running"],
            "log":      list(_import_job["log"]),
            "results":  list(_import_job["results"]),
            "done":     _import_job["done"],
            "error":    _import_job["error"],
        })


@bp.route("/api/library/import/abort", methods=["POST"])
def library_import_abort():
    with _import_lock:
        if not _import_job["running"]:
            return jsonify({"ok": False, "message": "No import running"}), 400
        _import_job["stop_requested"] = True
    return jsonify({"ok": True, "message": "Abort requested"})


@bp.route("/api/library/import/folder", methods=["POST"])
def library_import_folder():
    with _import_lock:
        if _import_job["running"]:
            return jsonify({"error": "An import is already running"}), 409

    data        = request.json or {}
    folder_path = data.get("folder_path", "").strip()
    if not folder_path:
        return jsonify({"error": "folder_path is required"}), 400
    folder = Path(folder_path)
    if not folder.is_dir():
        return jsonify({"error": f"Not a directory: {folder_path}"}), 400

    _reset_import_job()
    threading.Thread(target=_run_folder_import, args=(folder,), daemon=True).start()
    return jsonify({"ok": True, "message": f"Import started from {folder_path}"})


@bp.route("/api/library/import/zip", methods=["POST"])
def library_import_zip():
    with _import_lock:
        if _import_job["running"]:
            return jsonify({"error": "An import is already running"}), 409

    files = request.files.getlist("zips")
    if not files:
        return jsonify({"error": "No files uploaded"}), 400

    tmp_dir = Path(tempfile.mkdtemp(prefix="iracing_lib_"))
    saved   = [tmp_dir / f.filename for f in files
               if f.filename and f.filename.lower().endswith(".zip")
               and not f.save(tmp_dir / f.filename) or True]  # save as side-effect
    # Re-do correctly:
    saved = []
    for f in files:
        if f.filename and f.filename.lower().endswith(".zip"):
            dest = tmp_dir / f.filename
            f.save(dest)
            saved.append(dest)

    if not saved:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return jsonify({"error": "No valid .zip files in upload"}), 400

    _reset_import_job()
    threading.Thread(target=_run_zip_import, args=(saved, tmp_dir), daemon=True).start()
    return jsonify({"ok": True, "message": f"Import started for {len(saved)} zip(s)"})


@bp.route("/api/library/import/zip-peek", methods=["POST"])
def library_import_zip_peek():
    """
    Quickly inspect one or more uploaded zips without parsing PSDs.
    Returns livery_map resolution status + prefill suggestions so the
    frontend can show the metadata editor for unmapped zips before importing.

    Saves zips to a temp dir keyed by zip name; the same files can be
    re-used by /api/library/import/zip-with-meta.
    """
    files = request.files.getlist("zips")
    if not files:
        return jsonify({"error": "No files uploaded"}), 400

    tmp_dir = Path(tempfile.mkdtemp(prefix="iracing_peek_"))
    results = []
    for f in files:
        if not f.filename or not f.filename.lower().endswith(".zip"):
            continue
        dest = tmp_dir / f.filename
        f.save(dest)
        info = peek_zip(dest)
        info["tmp_path"] = str(dest)   # frontend will send this back for import
        results.append(info)

    if not results:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return jsonify({"error": "No valid .zip files"}), 400

    return jsonify({"results": results, "tmp_dir": str(tmp_dir)})


@bp.route("/api/library/import/zip-with-meta", methods=["POST"])
def library_import_zip_with_meta():
    """
    Import one or more previously-peeked zips, with user-supplied metadata
    for zips that weren't in the livery_map.

    Request JSON:
    {
      "zips": [
        {
          "tmp_path": "/tmp/iracing_peek_xxx/foo.zip",
          "display_name": "Porsche 911 GT3 Cup",
          "iracing_folder": "porsche_911gt3cup_992"
        },
        ...
      ]
    }
    """
    with _import_lock:
        if _import_job["running"]:
            return jsonify({"error": "An import is already running"}), 409

    data = request.json or {}
    zips_meta = data.get("zips", [])
    if not zips_meta:
        return jsonify({"error": "No zips provided"}), 400

    # Validate all tmp_paths exist
    zip_entries = []
    for entry in zips_meta:
        p = Path(entry.get("tmp_path", ""))
        if not p.exists() or not p.suffix.lower() == ".zip":
            return jsonify({"error": f"File not found or not a zip: {p}"}), 400
        zip_entries.append({
            "path": p,
            "injected_meta": {
                "display_name": entry.get("display_name", "").strip() or p.stem,
                "iracing_folder": entry.get("iracing_folder", "").strip(),
            },
        })

    tmp_dirs = {str(e["path"].parent) for e in zip_entries}

    _reset_import_job()
    threading.Thread(
        target=_run_zip_import_with_meta,
        args=(zip_entries, tmp_dirs),
        daemon=True,
    ).start()
    return jsonify({"ok": True, "message": f"Import started for {len(zip_entries)} zip(s)"})


@bp.route("/api/library/car/<slug>", methods=["DELETE"])
def library_delete_car(slug: str):
    if not re.match(r"^[a-z0-9_-]+$", slug):
        return jsonify({"error": "Invalid slug"}), 400
    for base in (LIBRARY_DIR, get_user_cars_dir()):
        car_dir = base / slug
        if car_dir.exists():
            shutil.rmtree(car_dir)
    invalidate_cars_cache()
    return jsonify({"ok": True})


@bp.route("/api/library/car/<slug>/set-folder", methods=["POST"])
def library_set_folder(slug: str):
    data   = request.json or {}
    folder = data.get("iracing_folder", "").strip()
    meta_path = _find_meta(slug)
    if not meta_path:
        return jsonify({"error": "Car not found"}), 404
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    meta["iracing_folder"] = folder
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    invalidate_cars_cache()
    return jsonify({"ok": True})


@bp.route("/api/library/car/<slug>/set-meta", methods=["POST"])
def library_set_meta(slug: str):
    data      = request.json or {}
    meta_path = _find_meta(slug)
    if not meta_path:
        return jsonify({"error": "Car not found"}), 404
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    if "display_name" in data:
        meta["display_name"] = data["display_name"].strip()
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    invalidate_cars_cache()
    return jsonify({"ok": True})


@bp.route("/api/library/car/upload-image", methods=["POST"])
def library_upload_image():
    from PIL import Image
    import io

    file     = request.files.get("file")
    img_type = request.form.get("type", "").strip()
    slug     = request.form.get("slug", "").strip()

    if not file or img_type not in ("wire", "diffuse"):
        return jsonify({"error": "file and type (wire|diffuse) are required"}), 400
    if not slug or not re.match(r"^[a-z0-9_-]+$", slug):
        return jsonify({"error": "slug is required and must be valid"}), 400

    car_dir = None
    for base in (get_user_cars_dir(), LIBRARY_DIR):
        candidate = base / slug
        if candidate.exists():
            car_dir = candidate
            break
    if not car_dir:
        return jsonify({"error": "Car not found in library"}), 404

    filename = "wire.jpg" if img_type == "wire" else "diffuse.jpg"
    dest     = car_dir / filename
    try:
        img = Image.open(io.BytesIO(file.read())).convert("RGB")
        img.save(str(dest), "JPEG", quality=92)
    except Exception as e:
        return jsonify({"error": f"Failed to save image: {e}"}), 500

    return jsonify({"ok": True, "url": f"/api/library/image/{slug}/{filename}", "path": str(dest), "slug": slug})


@bp.route("/api/library/image/<slug>/<filename>")
def library_image(slug: str, filename: str):
    if not re.match(r"^[a-z0-9_-]+$", slug):
        return jsonify({"error": "Invalid slug"}), 400
    if filename not in ("wire.jpg", "diffuse.jpg"):
        return jsonify({"error": "Invalid filename"}), 400
    for base in (get_user_cars_dir(), LIBRARY_DIR):
        car_dir = base / slug
        if (car_dir / filename).exists():
            return send_from_directory(str(car_dir), filename)
    return jsonify({"error": "Not found"}), 404


# ── Import helpers ────────────────────────────────────────────────────────────

def _find_meta(slug: str) -> Path | None:
    for base in (get_user_cars_dir(), LIBRARY_DIR):
        candidate = base / slug / "meta.json"
        if candidate.exists():
            return candidate
    return None


def _run_folder_import(folder: Path) -> None:
    try:
        user_cars = get_user_cars_dir()
        user_cars.mkdir(parents=True, exist_ok=True)
        for result in extract_folder_batch(folder, out_dir=user_cars, progress_cb=_append_log, stop_flag=_should_stop):
            if _should_stop():
                _append_log("Import aborted by user.")
                break
            _append_result(result)
            if result["ok"]:
                invalidate_cars_cache()
    except Exception as exc:
        with _import_lock:
            _import_job["error"] = str(exc)
    finally:
        with _import_lock:
            _import_job["running"] = False
            _import_job["done"]    = True


def _run_zip_import(zip_paths: list, tmp_dir: Path) -> None:
    try:
        user_cars = get_user_cars_dir()
        user_cars.mkdir(parents=True, exist_ok=True)
        for i, zip_path in enumerate(zip_paths, 1):
            if _should_stop():
                _append_log("Import aborted by user.")
                break
            _append_log(f"[{i}/{len(zip_paths)}] {zip_path.name}")
            for result in extract_from_zip(zip_path, out_dir=user_cars, progress_cb=_append_log):
                result["zip"] = zip_path.name
                _append_result(result)
                if result["ok"]:
                    invalidate_cars_cache()
    except Exception as exc:
        with _import_lock:
            _import_job["error"] = str(exc)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        with _import_lock:
            _import_job["running"] = False
            _import_job["done"]    = True


def _run_zip_import_with_meta(zip_entries: list[dict], tmp_dirs: set[str]) -> None:
    """
    Import zips with user-supplied metadata for unmapped entries.
    zip_entries: [{"path": Path, "injected_meta": {"display_name": str, "iracing_folder": str}}]
    """
    try:
        user_cars = get_user_cars_dir()
        user_cars.mkdir(parents=True, exist_ok=True)
        total = len(zip_entries)
        for i, entry in enumerate(zip_entries, 1):
            if _should_stop():
                _append_log("Import aborted by user.")
                break
            zip_path: Path = entry["path"]
            injected: dict = entry["injected_meta"]
            _append_log(f"[{i}/{total}] {zip_path.name}")
            for result in extract_from_zip(
                zip_path,
                out_dir=user_cars,
                progress_cb=_append_log,
                injected_meta=injected,
            ):
                result["zip"] = zip_path.name
                _append_result(result)
                if result["ok"]:
                    invalidate_cars_cache()
    except Exception as exc:
        with _import_lock:
            _import_job["error"] = str(exc)
    finally:
        for d in tmp_dirs:
            shutil.rmtree(d, ignore_errors=True)
        with _import_lock:
            _import_job["running"] = False
            _import_job["done"]    = True

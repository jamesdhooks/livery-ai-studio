"""
server/routes/api_files.py
--------------------------
File upload, file browser, native file/folder pickers, preview serving.

/api/upload-file           POST   Upload a file to wire/base/reference bucket
/api/upload-file           DELETE Delete an uploaded file + metadata
/api/persist-upload        POST   Copy a file into a category bucket
/api/browse-uploads/<cat>  GET    List uploads with metadata (car association etc.)
/api/uploads/preview       GET    Serve an uploaded/library image
/api/pick-file             POST   Native file-open dialog
/api/pick-folder           POST   Native folder dialog
/api/save-file             POST   Native save dialog
/api/save-temp-file        POST   Save to temp
/api/download-file         POST   Native save-as dialog
/api/open-explorer         POST   Open file in Explorer
"""

from __future__ import annotations

import json
import re
import shutil
import tempfile
import time
import uuid
from pathlib import Path

from flask import Blueprint, jsonify, request, send_file

from server.config import get_data_dir, get_uploads_dir
from server.extract import LIBRARY_DIR

bp = Blueprint("api_files", __name__)


# ── Metadata helpers ──────────────────────────────────────────────────────────

def _meta_path(image_path: Path) -> Path:
    """Return the sidecar .meta.json path for a given image."""
    return image_path.parent / f"{image_path.stem}.meta.json"


def _write_meta(image_path: Path, car_folder: str = "", car_display: str = ""):
    """Write a sidecar metadata JSON next to the uploaded image."""
    meta = {
        "filename": image_path.name,
        "car_folder": car_folder,
        "car_display": car_display,
        "uploaded_at": time.time(),
    }
    try:
        with open(_meta_path(image_path), "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
    except Exception as e:
        print(f"[meta] Warning: could not write metadata for {image_path}: {e}")


def _read_meta(image_path: Path) -> dict:
    """Read sidecar metadata for an image, returning defaults if missing."""
    mp = _meta_path(image_path)
    if mp.exists():
        try:
            with open(mp, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "filename": image_path.name,
        "car_folder": "",
        "car_display": "",
        "uploaded_at": image_path.stat().st_mtime if image_path.exists() else 0,
    }


# ── Upload ────────────────────────────────────────────────────────────────────

@bp.route("/api/upload-file", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "Empty filename"}), 400

    category    = request.form.get("category", "").strip()
    car_folder  = request.form.get("car_folder", "").strip()
    car_display = request.form.get("car_display", "").strip()
    ext         = Path(f.filename).suffix.lower() or ".png"

    if category in ("wire", "base", "reference"):
        dest_dir = get_uploads_dir(category)
    else:
        dest_dir = Path(tempfile.gettempdir()) / "iracing_livery_uploads"

    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^\w\-.]", "_", Path(f.filename).name)
    dest = dest_dir / safe_name
    if dest.exists():
        dest = dest_dir / f"{dest.stem}_{uuid.uuid4().hex[:6]}{ext}"

    f.save(str(dest))
    _write_meta(dest, car_folder=car_folder, car_display=car_display)
    print(f"[upload] Saved → {dest}")
    return jsonify({"path": str(dest)})


@bp.route("/api/upload-file", methods=["DELETE"])
def delete_upload():
    """Delete an uploaded file and its sidecar metadata."""
    data = request.json or {}
    path = data.get("path", "").strip()

    if not path:
        return jsonify({"error": "No path provided"}), 400

    p = Path(path)
    # Safety: only allow deletion within the data directory
    try:
        p.relative_to(get_data_dir())
    except ValueError:
        return jsonify({"error": "Cannot delete files outside data directory"}), 403

    deleted = []
    if p.exists() and p.is_file():
        p.unlink()
        deleted.append(str(p))

    mp = _meta_path(p)
    if mp.exists():
        mp.unlink()
        deleted.append(str(mp))

    print(f"[delete] Removed: {deleted}")
    return jsonify({"deleted": deleted})


@bp.route("/api/persist-upload", methods=["POST"])
def persist_upload():
    data     = request.json or {}
    src      = data.get("path", "").strip()
    category = data.get("category", "").strip()

    if not src or not Path(src).exists():
        return jsonify({"error": "Source file not found"}), 404
    if category not in ("wire", "base", "reference"):
        return jsonify({"error": "Invalid category"}), 400

    dest_dir = get_uploads_dir(category)
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^\w\-.]", "_", Path(src).name)
    dest = dest_dir / safe_name

    if dest.exists() and str(Path(src).resolve()) == str(dest.resolve()):
        return jsonify({"path": str(dest)})
    if dest.exists():
        ext  = Path(src).suffix.lower()
        dest = dest_dir / f"{dest.stem}_{uuid.uuid4().hex[:6]}{ext}"

    shutil.copy2(src, dest)
    print(f"[persist] Copied {src} → {dest}")
    return jsonify({"path": str(dest)})


# ── Browse ────────────────────────────────────────────────────────────────────

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tga", ".bmp"}


@bp.route("/api/browse-uploads/<category>", methods=["GET"])
def browse_uploads(category: str):
    if category not in ("wire", "base", "reference"):
        return jsonify({"error": "Invalid category"}), 400
    uploads_dir = get_uploads_dir(category)
    if not uploads_dir.exists():
        return jsonify([])
    items = []
    for fp in sorted(uploads_dir.iterdir(), key=lambda f: f.stat().st_mtime, reverse=True):
        if fp.suffix.lower() in IMAGE_EXTS and fp.is_file():
            meta = _read_meta(fp)
            items.append({
                "path": str(fp),
                "name": fp.name,
                "size": fp.stat().st_size,
                "car_folder": meta.get("car_folder", ""),
                "car_display": meta.get("car_display", ""),
                "uploaded_at": meta.get("uploaded_at", fp.stat().st_mtime),
            })
    return jsonify(items)


# ── Preview ───────────────────────────────────────────────────────────────────

@bp.route("/api/uploads/preview")
def api_uploads_preview():
    """Serve an uploaded or library image by absolute path.  TGA → PNG on-the-fly."""
    path = request.args.get("path", "").strip()
    if not path:
        return jsonify({"error": "No path provided"}), 400

    p = Path(path)
    if not p.is_absolute():
        return jsonify({"error": "Path must be absolute"}), 400

    allowed = False
    temp_uploads = Path(tempfile.gettempdir()) / "iracing_livery_uploads"
    for base in (get_data_dir(), LIBRARY_DIR, temp_uploads):
        try:
            p.relative_to(base)
            allowed = True
            break
        except ValueError:
            pass

    if not allowed or not p.exists() or not p.is_file():
        return jsonify({"error": "File not found or not allowed"}), 404

    if p.suffix.lower() == ".tga":
        from PIL import Image
        import io
        buf = io.BytesIO()
        Image.open(p).convert("RGBA").save(buf, format="PNG")
        buf.seek(0)
        return send_file(buf, mimetype="image/png")

    return send_file(str(p))


# ── Native dialogs (pywebview) ────────────────────────────────────────────────

def _window():
    """Return the active pywebview window, or None."""
    try:
        import webview
        return webview.windows[0] if webview.windows else None
    except Exception:
        return None


@bp.route("/api/pick-file", methods=["POST"])
def pick_file():
    data           = request.json or {}
    file_types     = tuple(data.get("file_types", ("Image Files (*.png;*.jpg;*.jpeg;*.tga)",)))
    allow_multiple = data.get("allow_multiple", False)

    win = _window()
    if win is None:
        return jsonify({"error": "No window available"}), 400

    import webview
    result = win.create_file_dialog(webview.OPEN_DIALOG, file_types=file_types, allow_multiple=allow_multiple)
    if allow_multiple:
        return jsonify({"paths": result if result else []})
    return jsonify({"path": result[0] if result else None})


@bp.route("/api/pick-folder", methods=["POST"])
def pick_folder():
    win = _window()
    if win is None:
        return jsonify({"error": "No window available"}), 400

    import webview
    result = win.create_file_dialog(webview.FOLDER_DIALOG)
    return jsonify({"path": result[0] if result else None})


@bp.route("/api/save-file", methods=["POST"])
def save_file_dialog():
    import base64 as _b64
    import time as _time

    data        = request.json or {}
    image_b64   = data.get("image_b64")
    default_name = data.get("filename", f"livery-{int(_time.time())}.png")

    if not image_b64:
        return jsonify({"error": "No image data provided"}), 400

    win = _window()
    if win is None:
        return jsonify({"error": "No window available"}), 400

    import webview
    result = win.create_file_dialog(
        webview.SAVE_DIALOG,
        save_filename=default_name,
        file_types=("PNG Images (*.png)", "All Files (*.*)",),
    )
    if result:
        save_path = result[0]
        try:
            with open(save_path, "wb") as f:
                f.write(_b64.b64decode(image_b64))
            return jsonify({"path": save_path, "status": "ok"})
        except Exception as e:
            return jsonify({"error": f"Failed to save file: {e}"}), 500
    return jsonify({"path": None})


@bp.route("/api/save-temp-file", methods=["POST"])
def save_temp_file():
    import base64 as _b64
    import time as _time

    data     = request.json or {}
    file_b64 = data.get("file_b64")
    filename = data.get("filename", "temp-file")

    if not file_b64:
        return jsonify({"error": "No file data provided"}), 400

    try:
        temp_path = Path(tempfile.gettempdir()) / f"livery-gen-{int(_time.time())}-{filename}"
        temp_path.write_bytes(_b64.b64decode(file_b64))
        return jsonify({"path": str(temp_path), "status": "ok"})
    except Exception as e:
        return jsonify({"error": f"Failed to save temp file: {e}"}), 500


@bp.route("/api/download-file", methods=["POST"])
def download_file():
    data         = request.json or {}
    source_path  = data.get("path", "").strip()
    default_name = data.get("filename", "")

    if not source_path or not Path(source_path).exists():
        return jsonify({"error": "Source file not found"}), 404

    default_name = default_name or Path(source_path).name
    ext = Path(source_path).suffix.lower()

    file_types = ("All Files (*.*)",)
    if ext == ".tga":
        file_types = ("TGA Images (*.tga)", "All Files (*.*)")
    elif ext in (".jpg", ".jpeg"):
        file_types = ("JPEG Images (*.jpg;*.jpeg)", "All Files (*.*)")
    elif ext == ".png":
        file_types = ("PNG Images (*.png)", "All Files (*.*)")

    win = _window()
    if win is None:
        return jsonify({"error": "No window available"}), 400

    import webview
    result = win.create_file_dialog(webview.SAVE_DIALOG, save_filename=default_name, file_types=file_types)
    if result:
        save_path = result[0]
        try:
            shutil.copy2(source_path, save_path)
            return jsonify({"path": save_path, "status": "ok"})
        except Exception as e:
            return jsonify({"error": f"Failed to save file: {e}"}), 500
    return jsonify({"path": None})


@bp.route("/api/open-explorer", methods=["POST"])
def api_open_explorer():
    import subprocess
    data      = request.json or {}
    file_path = data.get("path", "").strip()
    if not file_path or not Path(file_path).exists():
        return jsonify({"error": "File not found"}), 404
    try:
        subprocess.Popen(["explorer", "/select,", file_path.replace("/", "\\")])
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

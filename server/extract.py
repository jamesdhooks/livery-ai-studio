"""
extract_psd.py — Extract wireframe and diffuse JPGs from iRacing template PSDs.

Handles both:
  - A directory of .zip files (batch mode)
  - A single .zip file (single mode)

Each zip contains exactly one .psd. The PSD always has a 'Wire' layer (hidden
by default) inside a 'Turn Off Before Exporting TGA' group.

Outputs per car (saved to LIBRARY_DIR/<slug>/):
  wire.jpg    — Wire layer composited onto white background
  diffuse.jpg — Full PSD composite (Wire hidden, as-is default state)
  meta.json   — { display_name, slug, iracing_folder, zip_name, psd_name, psd_display_name, width, height }
"""

from __future__ import annotations

import io
import json
import sys
import logging
import re
import warnings
import zipfile
from pathlib import Path
from typing import Callable, Generator

warnings.filterwarnings("ignore")

from PIL import Image

# ── Optional psd-tools import (checked at call time) ──────────────────────────
try:
    from psd_tools import PSDImage  # type: ignore
    PSD_TOOLS_OK = True
except ImportError:
    PSD_TOOLS_OK = False

logger = logging.getLogger(__name__)

# ── App root (works both from source and as a PyInstaller onedir bundle) ──────
# PyInstaller 6+ (onedir): bundled data lives in _internal/ (_MEIPASS), not
# next to the .exe.  car_library and livery_map.json are read-only bundle data.
_BUNDLE_DIR: Path = (
    Path(sys._MEIPASS)
    if getattr(sys, "frozen", False)
    else Path(__file__).parent.parent   # repo root when running from source
)

# ── Library root ──────────────────────────────────────────────────────────────
LIBRARY_DIR = _BUNDLE_DIR / "car_library"

# ── Trading Paints folder map (populated from livery_map.json if present) ─────
_LIVERY_MAP: dict[str, dict] = {}  # lower-normalised key -> {"folder": ..., "display": ...}

LIVERY_MAP_PATH = _BUNDLE_DIR / "livery_map.json"


def _load_livery_map() -> dict[str, list[dict]]:
    """
    Load livery_map.json which maps zip filenames to one or more iRacing cars.

    Supported value formats (all normalised to list[{name, folder}]):
      Single object : { "name": "...", "folder": "..." }
      Array         : [ { "name": "...", "folder": "..." }, ... ]
      Legacy string : "folder_name"  (name falls back to zip stem)

    Keys must be the full zip filename, e.g. "99_template_IR18.zip".
    Lookup is case-insensitive.

    Returns dict: { "zip_filename_lower": [ {"name": "...", "folder": "..."}, ... ] }
    """
    global _LIVERY_MAP
    if _LIVERY_MAP:
        return _LIVERY_MAP
    if LIVERY_MAP_PATH.exists():
        try:
            with open(LIVERY_MAP_PATH, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if not content:
                    logger.debug("livery_map.json is empty")
                    return {}
                raw: dict = json.loads(content)

            for key, val in raw.items():
                k = key.lower()
                if isinstance(val, str):
                    # Legacy: bare folder string
                    _LIVERY_MAP[k] = [{"name": None, "folder": val}]
                elif isinstance(val, dict):
                    # Single object
                    _LIVERY_MAP[k] = [{"name": val.get("name"), "folder": str(val.get("folder", ""))}]
                elif isinstance(val, list):
                    # Array of objects
                    _LIVERY_MAP[k] = [
                        {"name": item.get("name"), "folder": str(item.get("folder", ""))}
                        for item in val if isinstance(item, dict)
                    ]
        except Exception as exc:
            logger.debug("Could not load livery_map.json: %s", exc)
    return _LIVERY_MAP


# ── Name normalisation helpers ────────────────────────────────────────────────
def _normalise(name: str) -> str:
    """Lower-case, strip punctuation/whitespace for fuzzy comparison."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _lookup_zip(zip_filename: str, livery_map: dict[str, list[dict]]) -> list[dict]:
    """
    Return the list of {name, folder} entries for a zip filename.
    Lookup is case-insensitive on the full filename (e.g. '99_template_IR18.zip').
    Returns an empty list if not found.
    """
    return livery_map.get(zip_filename.lower(), [])


def _slug(name: str) -> str:
    """Filesystem-safe slug for a display name."""
    return re.sub(r"[^a-z0-9_-]", "_", name.lower()).strip("_")


def _psd_to_pil(psd) -> Image.Image:
    """
    Safely convert PSD to PIL Image, bypassing psd-tools' problematic
    ImageMath.eval() that fails with newer Pillow versions.
    
    Falls back to rendering layer by layer if composite() fails.
    """
    try:
        return psd.composite()
    except (AttributeError, Exception):
        # Fallback: composite layers manually
        if psd.width == 0 or psd.height == 0:
            return Image.new("RGBA", (2048, 2048), (255, 255, 255, 255))
        img = Image.new("RGBA", (psd.width, psd.height), (255, 255, 255, 255))
        for layer in psd:
            if not hasattr(layer, "is_visible") or not layer.is_visible():
                continue
            try:
                layer_img = layer.composite()
                if layer_img and layer_img.size != (0, 0):
                    img.paste(
                        layer_img.convert("RGBA"),
                        (layer.left, layer.top),
                        layer_img.convert("RGBA") if layer_img.mode == "RGBA" else None,
                    )
            except Exception:
                pass
        return img



def _find_layer(layers, name_lower: str):
    """Depth-first search for a layer by normalised name."""
    for layer in layers:
        if layer.name.strip().lower() == name_lower:
            return layer
        if hasattr(layer, "__iter__"):
            found = _find_layer(layer, name_lower)
            if found:
                return found
    return None


def extract_from_zip(
    zip_path: Path,
    out_dir: Path | None = None,
    progress_cb: Callable[[str], None] | None = None,
    injected_meta: dict | None = None,
) -> list[dict]:
    """
    Extract wireframe + diffuse from a single template zip.

    A zip may map to multiple cars (via livery_map.json array entries).
    The PSD is parsed once; images are copied into each car's own slug directory.

    injected_meta (optional): overrides livery_map lookup. Dict with:
      { "display_name": str, "iracing_folder": str }
    This is used when the user manually provides metadata for an unmapped zip.

    Returns a list of result dicts (one per car):
      {
        "ok": bool,
        "display_name": str,
        "slug": str,
        "iracing_folder": str | None,
        "wire_path": str,
        "diffuse_path": str,
        "error": str | None,
        "needs_meta": bool,   # True when zip wasn't in livery_map and no injected_meta given
      }
    """
    import shutil

    if not PSD_TOOLS_OK:
        return [{"ok": False, "error": "psd-tools is not installed. Run: pip install psd-tools==1.9.31"}]

    def log(msg: str):
        logger.info(msg)
        if progress_cb:
            progress_cb(msg)

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            psd_names = [n for n in zf.namelist() if n.lower().endswith(".psd")]
            if not psd_names:
                return [{"ok": False, "error": f"No .psd found in {zip_path.name}"}]
            psd_name = psd_names[0]
            log(f"  Reading {psd_name} ({zf.getinfo(psd_name).file_size // 1024 // 1024} MB)…")
            psd_data = zf.read(psd_name)

        psd_display_name = Path(psd_name).stem  # for metadata

        # ── Resolve livery_map entries for this zip ──────────────────────────
        livery_map = _load_livery_map()

        # If caller injected metadata, use it directly (bypasses livery_map)
        if injected_meta:
            entries = [{
                "name": injected_meta.get("display_name") or zip_path.stem,
                "folder": injected_meta.get("iracing_folder") or None,
            }]
        else:
            entries = _lookup_zip(zip_path.name, livery_map)

        if livery_map and not entries and not injected_meta:
            log(f"  ⊘ No folder match for zip '{zip_path.name}' (skipping)")
            zip_slug = _slug(zip_path.stem)
            # Clean up any stale directory keyed to the zip stem (never the root out_dir)
            stale = (out_dir / zip_slug) if out_dir else (LIBRARY_DIR / zip_slug)
            if stale.exists():
                shutil.rmtree(stale, ignore_errors=True)
            return [{
                "ok": False,
                "needs_meta": True,
                "display_name": zip_path.stem,
                "slug": zip_slug,
                "zip": zip_path.name,
                "psd_name": psd_name,
                "error": f"No folder match for zip '{zip_path.name}' — fill in metadata to import",
            }]

        # If no livery_map at all, treat zip stem as a single unnamed entry
        if not entries:
            entries = [{"name": None, "folder": None}]

        # ── Parse PSD once ───────────────────────────────────────────────────
        log(f"  Parsing PSD…")
        psd = PSDImage.open(io.BytesIO(psd_data))
        del psd_data

        # ── Diffuse ──────────────────────────────────────────────────────────
        log(f"  Compositing diffuse…")
        diffuse_img = _psd_to_pil(psd)
        if diffuse_img.mode == "RGBA":
            bg = Image.new("RGB", diffuse_img.size, (255, 255, 255))
            bg.paste(diffuse_img, mask=diffuse_img.split()[3])
            diffuse_img = bg
        else:
            diffuse_img = diffuse_img.convert("RGB")
        log(f"  OK diffuse ({diffuse_img.width}x{diffuse_img.height})")

        # ── Wireframe ────────────────────────────────────────────────────────
        log(f"  Extracting wireframe layer…")
        wire_layer = _find_layer(psd, "wire")
        if wire_layer is None:
            return [{
                "ok": False,
                "error": f"No 'Wire' layer found in {psd_name}",
                "display_name": psd_display_name,
            }]

        wire_layer.visible = True
        wire_img = wire_layer.composite()
        wire_layer.visible = False

        wire_bg = Image.new("RGBA", (psd.width, psd.height), (0, 0, 0, 255))
        wc = wire_img.convert("RGBA")
        wire_bg.paste(wc, (wire_layer.left, wire_layer.top), wc.split()[3])
        wire_out = wire_bg.convert("RGB")
        log(f"  OK wire ({wire_out.width}x{wire_out.height})")
        del wire_img, wire_bg

        # ── Write one directory per entry ────────────────────────────────────
        results: list[dict] = []
        required_files = {"wire.jpg", "diffuse.jpg", "meta.json"}

        # Resolve URLs for this zip from livery_map.json once
        zip_url_data = {}
        try:
            from server.cars import _ZIP_URL_LOOKUP
            zip_url_data = _ZIP_URL_LOOKUP.get(zip_path.name, {})
        except Exception:
            pass

        for entry in entries:
            display_name = entry["name"] or psd_display_name
            iracing_folder = entry["folder"] or None
            slug = _slug(display_name)
            target_dir = out_dir / slug if out_dir else LIBRARY_DIR / slug

            # Skip if already fully imported
            if target_dir.exists():
                existing = {f.name for f in target_dir.iterdir() if f.is_file()}
                if required_files.issubset(existing):
                    log(f"  ⊘ '{display_name}' already imported (skipping)")
                    results.append({
                        "ok": False,
                        "display_name": display_name,
                        "slug": slug,
                        "error": "Already imported (skipped)",
                    })
                    continue

            target_dir.mkdir(parents=True, exist_ok=True)

            wire_path = target_dir / "wire.jpg"
            diffuse_path = target_dir / "diffuse.jpg"
            wire_out.save(wire_path, "JPEG", quality=92)
            diffuse_img.save(diffuse_path, "JPEG", quality=92)

            meta = {
                "display_name": display_name,
                "slug": slug,
                "iracing_folder": iracing_folder,
                "zip_name": zip_path.name,
                "psd_name": psd_name,
                "psd_display_name": psd_display_name,
                "width": psd.width,
                "height": psd.height,
                "trading_paints_url": zip_url_data.get("trading_paints_url", ""),
                "template_download_url": zip_url_data.get("template_download_url", ""),
            }
            with open(target_dir / "meta.json", "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)

            log(f"  ✓ {display_name}")
            results.append({
                "ok": True,
                "display_name": display_name,
                "slug": slug,
                "iracing_folder": iracing_folder,
                "zip": zip_path.name,
                "psd_name": psd_name,
                "width": psd.width,
                "height": psd.height,
                "trading_paints_url": zip_url_data.get("trading_paints_url", ""),
                "template_download_url": zip_url_data.get("template_download_url", ""),
                "wire_path": str(wire_path),
                "diffuse_path": str(diffuse_path),
                "error": None,
            })

        del diffuse_img, wire_out
        return results

    except Exception as exc:
        logger.exception("Failed to extract %s", zip_path.name)
        return [{"ok": False, "error": str(exc), "zip": zip_path.name}]


# ── Batch processing ──────────────────────────────────────────────────────────
def extract_folder(
    folder_path: Path,
    out_dir: Path | None = None,
    progress_cb: Callable[[str], None] | None = None,
    stop_flag: Callable[[], bool] | None = None,
    injected_meta_map: dict[str, dict] | None = None,
) -> Generator[dict, None, None]:
    """
    Yield result dicts for every .zip in folder_path.
    progress_cb(msg) is called with log lines.
    stop_flag() returns True to abort early.
    injected_meta_map: optional {zip_filename_lower: {display_name, iracing_folder}}
    """
    zips = sorted(folder_path.glob("*.zip"))
    total = len(zips)
    if total == 0:
        yield {"ok": False, "error": f"No .zip files found in {folder_path}"}
        return

    for i, zip_path in enumerate(zips, 1):
        if stop_flag and stop_flag():
            break
        if progress_cb:
            progress_cb(f"[{i}/{total}] {zip_path.name}")
        meta_override = (injected_meta_map or {}).get(zip_path.name.lower())
        for result in extract_from_zip(zip_path, out_dir=out_dir, progress_cb=progress_cb, injected_meta=meta_override):
            result["zip"] = zip_path.name
            result["index"] = i
            result["total"] = total
            yield result


# ── Zip peek (no PSD parse — just inspect what we know) ───────────────────────

def peek_zip(zip_path: Path) -> dict:
    """
    Quickly inspect a zip without parsing the PSD.
    Returns metadata the UI can prefill, plus whether the livery_map resolved it.

    Result dict:
      {
        "zip_name": str,
        "psd_name": str | None,
        "mapped": bool,           # True if found in livery_map.json
        "entries": [              # resolved entries (may be empty if not mapped)
          {"display_name": str, "iracing_folder": str}
        ],
        "suggested_display": str, # zip stem as fallback display name
        "suggested_slug":    str, # slug derived from zip stem
      }
    """
    result: dict = {
        "zip_name": zip_path.name,
        "psd_name": None,
        "mapped": False,
        "entries": [],
        "suggested_display": zip_path.stem,
        "suggested_slug": _slug(zip_path.stem),
    }
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            psd_names = [n for n in zf.namelist() if n.lower().endswith(".psd")]
            if psd_names:
                result["psd_name"] = psd_names[0]
    except Exception:
        pass

    livery_map = _load_livery_map()
    entries = _lookup_zip(zip_path.name, livery_map)
    if entries:
        result["mapped"] = True
        result["entries"] = [
            {"display_name": e["name"] or zip_path.stem, "iracing_folder": e["folder"] or ""}
            for e in entries
        ]
    return result


# ── Library reader ────────────────────────────────────────────────────────────
def list_library() -> list[dict]:
    """Return all cars in the library with their metadata."""
    if not LIBRARY_DIR.exists():
        return []
    cars = []
    for meta_file in sorted(LIBRARY_DIR.glob("*/meta.json")):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
            slug = meta_file.parent.name
            entry = {
                "slug": slug,
                "display_name": meta.get("display_name", slug),
                "iracing_folder": meta.get("iracing_folder") or "",
                "wire_path": str(meta_file.parent / "wire.jpg"),
                "diffuse_path": str(meta_file.parent / "diffuse.jpg"),
                "width": meta.get("width"),
                "height": meta.get("height"),
            }
            cars.append(entry)
        except Exception:
            pass
    return cars

"""
server/cars.py
--------------
Car library scanning, caching, and lookup.

Merges the repo-baseline library/ with user-override data/cars/.
User entries win on folder-name collision.
"""

from __future__ import annotations

import json
from pathlib import Path

from server.config import LIVERY_MAP_PATH, get_user_cars_dir
from server.extract import LIBRARY_DIR, list_library


# ── Trading-Paints / template URL lookup ─────────────────────────────────────
# Sourced from livery_map.json (pre-enriched offline).
# Keyed by zip_name → {trading_paints_url, template_download_url}.

def _build_zip_url_lookup() -> dict[str, dict]:
    lookup: dict[str, dict] = {}
    if not LIVERY_MAP_PATH.exists():
        return lookup
    try:
        with open(LIVERY_MAP_PATH, "r", encoding="utf-8") as f:
            livery_map = json.load(f)
        for zip_name, entries in livery_map.items():
            if isinstance(entries, dict):
                entries = [entries]
            for entry in entries:
                tp_url  = entry.get("trading_paints_url", "")
                tpl_url = entry.get("template_download_url", "")
                if tp_url or tpl_url:
                    lookup[zip_name] = {
                        "trading_paints_url": tp_url,
                        "template_download_url": tpl_url,
                    }
    except Exception:
        pass
    return lookup


_ZIP_URL_LOOKUP: dict[str, dict] = _build_zip_url_lookup()


# ── Directory scanner ─────────────────────────────────────────────────────────

def _scan_car_dirs(*dirs: Path) -> dict[str, dict]:
    """
    Scan directories for car metadata (*/meta.json).
    Returns dict keyed by iracing_folder.  Later dirs overwrite earlier ones.
    """
    cars: dict[str, dict] = {}
    for base in dirs:
        if not base.exists():
            continue
        for meta_file in sorted(base.glob("*/meta.json")):
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                folder  = (meta.get("iracing_folder") or "").strip()
                display = (meta.get("display_name") or meta_file.parent.name).strip()
                if folder:
                    zip_name = meta.get("zip_name", "")
                    url_data = _ZIP_URL_LOOKUP.get(zip_name, {})
                    cars[folder] = {
                        "folder": folder,
                        "slug": meta_file.parent.name,
                        "display": display,
                        # Prefer URL baked into meta.json (set at import time),
                        # fall back to live zip-name lookup from livery_map.json
                        "trading_paints_url": (
                            meta.get("trading_paints_url")
                            or url_data.get("trading_paints_url", "")
                        ),
                        "template_download_url": (
                            meta.get("template_download_url")
                            or url_data.get("template_download_url", "")
                        ),
                    }
            except Exception:
                pass
    return cars


# ── Cache ─────────────────────────────────────────────────────────────────────

_cars_cache: dict[str, dict] | None = None


def load_all_cars(force: bool = False) -> list[dict]:
    """
    Return the merged car list (library/ + data/cars/).
    Results are cached; pass force=True to re-scan.
    """
    global _cars_cache
    if _cars_cache is not None and not force:
        return list(_cars_cache.values())
    _cars_cache = _scan_car_dirs(LIBRARY_DIR, get_user_cars_dir())
    return list(_cars_cache.values())


def invalidate_cars_cache() -> None:
    """Force the next load_all_cars() call to re-scan directories."""
    global _cars_cache
    _cars_cache = None


def lookup_car_display(folder: str) -> str:
    """Return the display name for a car folder, falling back to the folder name."""
    cars = load_all_cars()
    return next((c["display"] for c in cars if c["folder"] == folder), folder)


def find_car_dir(car_folder: str) -> Path | None:
    """
    Find the filesystem directory for a car by its iracing_folder name.
    Checks user cars first, then the library.  Returns None if not found.
    """
    for base in (get_user_cars_dir(), LIBRARY_DIR):
        if not base.exists():
            continue
        for meta_file in base.glob("*/meta.json"):
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                if (meta.get("iracing_folder") or "").strip() == car_folder:
                    return meta_file.parent
            except Exception:
                pass
    return None


def list_library_cars() -> list[dict]:
    """
    Return all cars from the extracted library merged with user cars,
    keyed by slug.  User entries overwrite library entries.
    """
    cars_by_slug: dict[str, dict] = {e["slug"]: e for e in list_library()}

    user_cars_dir = get_user_cars_dir()
    if user_cars_dir.exists():
        for meta_file in sorted(user_cars_dir.glob("*/meta.json")):
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                slug = meta_file.parent.name
                cars_by_slug[slug] = {
                    "slug": slug,
                    "display_name": meta.get("display_name", slug),
                    "iracing_folder": meta.get("iracing_folder") or "",
                    "wire_path": str(meta_file.parent / "wire.jpg"),
                    "diffuse_path": str(meta_file.parent / "diffuse.jpg"),
                    "width": meta.get("width"),
                    "height": meta.get("height"),
                    "user_car": True,
                }
            except Exception:
                pass

    return list(cars_by_slug.values())

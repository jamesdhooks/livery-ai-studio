"""
server/config.py
----------------
Application paths, config load/save, and defaults.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
# PyInstaller 6+ (onedir) layout:
#   APP_DIR    = directory containing the .exe  (user-writable: config, data, logs)
#   BUNDLE_DIR = _internal/ sub-folder          (read-only bundled data: static, car_library, icons)
# When running from source both point to the repo root.
if getattr(sys, "frozen", False):
    APP_DIR: Path    = Path(sys.executable).parent          # next to .exe
    BUNDLE_DIR: Path = Path(sys._MEIPASS)                   # _internal/
else:
    APP_DIR: Path    = Path(__file__).parent.parent         # repo root
    BUNDLE_DIR: Path = APP_DIR                              # same as repo root

STATIC_DIR: Path      = BUNDLE_DIR / "static"
CONFIG_PATH: Path     = APP_DIR / "config.json"
LIVERY_MAP_PATH: Path = BUNDLE_DIR / "livery_map.json"

_DEFAULT_DATA_DIR: Path = APP_DIR / "data"

# ── Defaults ──────────────────────────────────────────────────────────────────
DEFAULT_CONFIG: dict = {
    "gemini_api_key": "",
    "customer_id": "",
    "use_fast_model": False,
    "default_wireframe": "",
    "default_base_texture": "",
    "default_car": "",
    "save_liveries": True,
    "data_dir": "",
    "recent_cars": [],
    "last_prompt": "",
    "last_car": "",
    "last_mode": "new",
    # Pricing overrides (USD per image). Defaults match Gemini API pricing as of 2025.
    # Users can update these in Settings → API Pricing if Google changes rates.
    "price_flash_1k": 0.067,
    "price_flash_2k": 0.101,
    "price_pro": 0.134,
    "spend_filter": "overall",
    # Per-car wireframe/base overrides: { "<car_folder>": { "wire": "/abs/path", "base": "/abs/path" } }
    "car_overrides": {},
    # Starred/favourite cars list
    "starred_cars": [],
    # Upscale engine preference: "realesrgan" (default) or "seedvr2"
    "upscale_engine": "realesrgan",
}


# ── Config I/O ────────────────────────────────────────────────────────────────

def load_config() -> dict:
    """Load config from disk, merging with defaults for any missing keys."""
    config = DEFAULT_CONFIG.copy()
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
            config.update(saved)
        except Exception:
            pass
    return config


def save_config(config: dict) -> None:
    """Persist config to disk as JSON."""
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


# ── Data-dir helpers ──────────────────────────────────────────────────────────

def get_data_dir() -> Path:
    """Return the user data directory, reading from config if overridden."""
    config = load_config()
    custom = config.get("data_dir", "").strip()
    return Path(custom) if custom else _DEFAULT_DATA_DIR


def get_liveries_dir() -> Path:
    return get_data_dir() / "liveries"


def get_thumbnails_dir() -> Path:
    """Return the internal thumbnail cache directory (hidden from users)."""
    d = get_data_dir() / ".thumbnails"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_user_cars_dir() -> Path:
    return get_data_dir() / "cars"


def get_uploads_dir(category: str) -> Path:
    """Return the persistent upload directory for a given category (wire/base/reference)."""
    return get_data_dir() / "generate" / category

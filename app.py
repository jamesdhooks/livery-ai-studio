"""
app.py - Livery AI Studio entry point
--------------------------------------
Thin launcher: creates the Flask app, registers all Blueprints, and starts
the pywebview native window.

All route logic lives inside server/routes/*.py.
All business logic lives inside server/*.py.
"""

import logging
import os
import sys
import threading
import traceback
from logging.handlers import RotatingFileHandler
from pathlib import Path

from flask import Flask, send_file, send_from_directory

# ── Logging setup (runs before anything else so all errors are captured) ──────
# Resolve paths early - mirrors server/config.py so logging starts before
# server.config is imported (which could itself fail).
# APP_DIR  = next to .exe (user-writable: config, logs, data)
# MEIPASS  = _internal/  (read-only bundled assets)
_APP_DIR_EARLY: Path = (
    Path(sys.executable).parent
    if getattr(sys, "frozen", False)
    else Path(__file__).parent
)
_LOG_PATH = _APP_DIR_EARLY / "app.log"

_log_handler = RotatingFileHandler(
    _LOG_PATH, maxBytes=1_000_000, backupCount=2, encoding="utf-8"
)
_log_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
))

logging.basicConfig(
    level=logging.INFO,
    handlers=[_log_handler, logging.StreamHandler(sys.stdout)],
)

# Redirect bare print() / stderr to the log file when frozen
if getattr(sys, "frozen", False):
    class _LogWriter:
        def __init__(self, level):
            self._level = level
            self._buf = ""
        def write(self, msg):
            self._buf += msg
            while "\n" in self._buf:
                line, self._buf = self._buf.split("\n", 1)
                if line.strip():
                    logging.log(self._level, line)
        def flush(self): pass
        def isatty(self): return False

    sys.stdout = _LogWriter(logging.INFO)
    sys.stderr = _LogWriter(logging.ERROR)

logger = logging.getLogger("livery_ai_studio")
logger.info("=" * 60)
logger.info("Livery AI Studio starting up")
logger.info("APP_DIR: %s", _APP_DIR_EARLY)
logger.info("Log file: %s", _LOG_PATH)
# ─────────────────────────────────────────────────────────────────────────────

# ── SSL fix: patch before google-genai is imported ────────────────────────────
try:
    import ssl as _ssl
    import certifi as _certifi
    _cert_path = _certifi.where()
    os.environ["SSL_CERT_FILE"]       = _cert_path
    os.environ["REQUESTS_CA_BUNDLE"] = _cert_path
    _orig_ssl_ctx = _ssl.create_default_context

    def _patched_ssl_ctx(*args, **kwargs):
        kwargs["cafile"] = _cert_path
        kwargs.pop("capath", None)
        return _orig_ssl_ctx(*args, **kwargs)

    _ssl.create_default_context = _patched_ssl_ctx
    logger.info("[SSL] Patched ssl.create_default_context")
except Exception as _e:
    logger.warning("[SSL] Could not patch SSL: %s", _e)
# ─────────────────────────────────────────────────────────────────────────────

from server.config import (
    APP_DIR,
    BUNDLE_DIR,
    STATIC_DIR,
    CONFIG_PATH,
    DEFAULT_CONFIG,
    load_config,
    save_config,
    get_data_dir,
    get_liveries_dir,
    get_user_cars_dir,
)
from server.cars import load_all_cars

from server.routes.api_config   import bp as bp_config
from server.routes.api_cars     import bp as bp_cars
from server.routes.api_files    import bp as bp_files
from server.routes.api_generate import bp as bp_generate
from server.routes.api_history  import bp as bp_history
from server.routes.api_window   import bp as bp_window

logger.info("All imports OK")

# ── Create Flask app ──────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=str(STATIC_DIR))

for _bp in (bp_config, bp_cars, bp_files, bp_generate, bp_history, bp_window):
    app.register_blueprint(_bp)

logger.info("Flask blueprints registered")

# ── Startup: Backfill spending log from existing history ─────────────────────
try:
    from server import spending as spending_log
    if spending_log.backfill_from_history():
        logger.info("Spending log backfilled from history sidecars")
    else:
        logger.info("Spending log already populated or no history to backfill")
except Exception as e:
    logger.error("Failed to backfill spending log: %s", e)

# ── Global error handler — logs full traceback for every 500 ─────────────────
@app.errorhandler(Exception)
def _handle_exception(e):
    logger.error("Unhandled exception in Flask route:\n%s", traceback.format_exc())
    from flask import jsonify
    return jsonify({"error": "Internal server error", "detail": str(e)}), 500


# ── SPA catch-all ─────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_file(STATIC_DIR / "index.html")


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(STATIC_DIR, filename)


@app.route("/<path:path>")
def serve_spa(path):
    """Return the file if it exists; otherwise fall back to index.html (SPA routing)."""
    full = STATIC_DIR / path
    if full.exists() and full.is_file():
        return send_from_directory(str(STATIC_DIR), path)
    return send_file(STATIC_DIR / "index.html")


# ── Icon helpers ─────────────────────────────────────────────────────────────

_ICO_PATH = BUNDLE_DIR / "icon.ico"


def _ensure_ico() -> str:
    """
    Return the path to icon.ico bundled in _internal/.
    Falls back to icon.png if .ico is missing.
    """
    if not _ICO_PATH.exists():
        try:
            import io
            from PIL import Image
            img = Image.open(str(BUNDLE_DIR / "icon.png")).convert("RGBA")
            img.save(
                str(_ICO_PATH),
                format="ICO",
                sizes=[(256, 256), (64, 64), (48, 48), (32, 32), (16, 16)],
            )
            logger.info("[icon] Generated %s", _ICO_PATH)
        except Exception as e:
            logger.warning("[icon] Could not generate .ico: %s", e)
            return str(BUNDLE_DIR / "icon.png")   # fall back to PNG
    return str(_ICO_PATH)


def _apply_app_user_model_id():
    """Break grouping with python.exe so Windows shows our icon on the taskbar."""
    try:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            "LiveryAIStudio.App"
        )
        logger.info("[icon] AppUserModelID set")
    except Exception as e:
        logger.warning("[icon] AppUserModelID failed: %s", e)


# ── Flask server thread ───────────────────────────────────────────────────────
def start_flask():
    port = int(os.environ.get("FLASK_PORT", "5199"))
    logger.info("Flask starting on http://127.0.0.1:%d", port)
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)


# ── Main entry point ──────────────────────────────────────────────────────────
def main():
    import webview

    # Ensure required data directories exist
    get_data_dir().mkdir(parents=True, exist_ok=True)
    get_liveries_dir().mkdir(parents=True, exist_ok=True)
    get_user_cars_dir().mkdir(parents=True, exist_ok=True)
    logger.info("Data dir: %s", get_data_dir())

    # Prime the car cache on startup
    logger.info("Loading car library...")
    load_all_cars(force=True)
    logger.info("Car library loaded")

    # Write default config on first run
    if not CONFIG_PATH.exists():
        save_config(DEFAULT_CONFIG)

    # Start Flask in a background thread
    server = threading.Thread(target=start_flask, daemon=True)
    server.start()

    port = int(os.environ.get("FLASK_PORT", "5199"))
    web_only = os.environ.get("WEB_ONLY", "0") == "1"

    _apply_app_user_model_id()
    ico = _ensure_ico()

    if web_only:
        logger.info("Launching in browser (web-only mode)")
        import webbrowser
        webbrowser.open(f"http://127.0.0.1:{port}")
        # Keep Flask running
        start_flask()
    else:
        os.environ['PYWEBVIEW_ICON'] = ico

        win = webview.create_window(
            title="Livery AI Studio",
            url=f"http://127.0.0.1:{port}",
            min_size=(800, 700),
            resizable=True,
            text_select=True,
            maximized=True,
        )
        try:
            webview.start(private_mode=False)
        except Exception:
            logger.exception("pywebview failed to start — falling back to browser")
            import webbrowser
            webbrowser.open(f"http://127.0.0.1:{port}")
            input("Press Enter to exit...")


if __name__ == "__main__":
    main()

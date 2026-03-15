"""
server/routes/api_window.py
---------------------------
/api/window/minimize  — minimise the pywebview window
/api/window/maximize  — toggle maximise/restore
/api/window/state     — return current maximised state
/api/window/close     — destroy the window
/api/log-path         — return absolute path to app.log
"""

from __future__ import annotations

from flask import Blueprint, jsonify

bp = Blueprint("api_window", __name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_hwnd():
    """Return the native Win32 HWND for the pywebview window, or None."""
    try:
        import ctypes
        import webview

        win = webview.windows[0] if webview.windows else None
        if not win:
            return None

        # pywebview ≥4 stores the HWND on the GUI object
        try:
            hwnd = win.gui.BrowserView.instances[win.uid].Handle.ToInt32()
            return hwnd
        except Exception:
            pass

        # Fallback: find by window title
        hwnd = ctypes.windll.user32.FindWindowW(None, win.title)
        return hwnd if hwnd else None
    except Exception:
        return None


def _is_maximized() -> bool:
    """Check whether the window is currently maximised via Win32 API."""
    try:
        import ctypes

        hwnd = _get_hwnd()
        if not hwnd:
            return False
        WS_MAXIMIZE = 0x01000000
        style = ctypes.windll.user32.GetWindowLongW(hwnd, -16)  # GWL_STYLE
        return bool(style & WS_MAXIMIZE)
    except Exception:
        return False


# ── Routes ────────────────────────────────────────────────────────────────────

@bp.route("/api/window/minimize", methods=["POST"])
def window_minimize():
    try:
        import webview
        win = webview.windows[0] if webview.windows else None
        if win:
            win.minimize()
    except Exception:
        pass
    return jsonify({"ok": True})


@bp.route("/api/window/maximize", methods=["POST"])
def window_maximize():
    try:
        import webview
        win = webview.windows[0] if webview.windows else None
        if win:
            if _is_maximized():
                win.restore()
            else:
                win.maximize()
    except Exception:
        pass
    return jsonify({"ok": True, "maximized": _is_maximized()})


@bp.route("/api/window/state", methods=["GET"])
def window_state():
    """Return current maximised state so the frontend can sync its button."""
    return jsonify({"maximized": _is_maximized()})


@bp.route("/api/window/close", methods=["POST"])
def window_close():
    try:
        import webview
        win = webview.windows[0] if webview.windows else None
        if win:
            win.destroy()
    except Exception:
        pass
    return jsonify({"ok": True})


@bp.route("/api/log-path", methods=["GET"])
def log_path():
    """Return the absolute path to app.log so the frontend can show it to the user."""
    from server.config import APP_DIR
    path = APP_DIR / "app.log"
    return jsonify({"path": str(path), "exists": path.exists()})

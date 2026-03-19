"""
server/routes/api_monitor.py
----------------------------
/api/monitor/start    POST  — start watching a folder
/api/monitor/stop     POST  — stop watching
/api/monitor/status   GET   — current monitor state
/api/monitor/events   GET   — SSE stream of deploy notifications
"""

from __future__ import annotations

import logging
import time

from flask import Blueprint, Response, jsonify, request, stream_with_context

from server.config import load_config
from server.deploy import deploy_livery, deploy_spec_livery
from server.monitor import (
    get_monitor,
    start_monitor,
    stop_monitor,
    subscribe_sse,
    unsubscribe_sse,
)

logger = logging.getLogger(__name__)
bp = Blueprint("api_monitor", __name__)


# ── Start ──────────────────────────────────────────────────────────────────────

@bp.route("/api/monitor/start", methods=["POST"])
def api_monitor_start():
    data = request.get_json(force=True) or {}
    folder_path = (data.get("folder") or "").strip()
    car_name    = (data.get("car_name") or "").strip()

    if not folder_path:
        return jsonify({"error": "folder is required"}), 400
    if not car_name:
        return jsonify({"error": "car_name is required"}), 400

    config = load_config()
    customer_id = str(config.get("customer_id") or "").strip()
    if not customer_id:
        return jsonify({"error": "iRacing Customer ID is not set in Settings"}), 400

    monitor = start_monitor(
        folder_path=folder_path,
        customer_id=customer_id,
        car_name=car_name,
        deploy_fn=deploy_livery,
        deploy_spec_fn=deploy_spec_livery,
    )

    logger.info("[api_monitor] Started for folder=%s car=%s", folder_path, car_name)
    return jsonify({"ok": True, "monitor": monitor.to_dict()})


# ── Stop ───────────────────────────────────────────────────────────────────────

@bp.route("/api/monitor/stop", methods=["POST"])
def api_monitor_stop():
    stop_monitor()
    logger.info("[api_monitor] Stopped")
    return jsonify({"ok": True})


# ── Status ─────────────────────────────────────────────────────────────────────

@bp.route("/api/monitor/status", methods=["GET"])
def api_monitor_status():
    m = get_monitor()
    if m and m.is_running:
        return jsonify({"active": True, "monitor": m.to_dict()})
    return jsonify({"active": False, "monitor": None})


# ── SSE event stream ───────────────────────────────────────────────────────────

@bp.route("/api/monitor/events", methods=["GET"])
def api_monitor_events():
    """
    Server-Sent Events stream. Each event is a JSON-encoded dict on a
    ``data:`` line followed by two newlines.

    Keeps the connection alive with a comment ping every 15 seconds so
    proxies and pywebview don't time it out.
    """

    q = subscribe_sse()

    @stream_with_context
    def generate():
        try:
            # Initial ping so the client knows the connection is live
            yield ": connected\n\n"
            last_ping = time.time()

            while True:
                # Check the queue with a short timeout so we can send pings
                try:
                    payload = q.get(timeout=5)
                    yield f"data: {payload}\n\n"
                except Exception:
                    pass  # queue.Empty — just send a ping if due

                if time.time() - last_ping >= 15:
                    yield ": ping\n\n"
                    last_ping = time.time()
        finally:
            unsubscribe_sse(q)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

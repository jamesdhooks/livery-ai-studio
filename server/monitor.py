"""
server/monitor.py
-----------------
Folder Monitor — watches a directory for car_{customer_id}.tga and
car_spec_{customer_id}.tga, then auto-deploys them to the iRacing paint
folder whenever the files are created or modified.

Uses polling (stat mtime) so there are no extra dependencies and it works
reliably through Photoshop / GIMP save-over-file behaviour which can
confuse event-based watchers on Windows.

Events are pushed to connected SSE clients via a simple queue.
"""

from __future__ import annotations

import json
import logging
import queue
import threading
import time
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

# How often to poll the watched files (seconds)
POLL_INTERVAL = 1.0


# ── SSE event bus ─────────────────────────────────────────────────────────────

class _EventBus:
    """Fanout queue — each connected SSE client gets its own queue."""

    def __init__(self) -> None:
        self._lock: threading.Lock = threading.Lock()
        self._queues: list[queue.Queue] = []

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=50)
        with self._lock:
            self._queues.append(q)
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        with self._lock:
            try:
                self._queues.remove(q)
            except ValueError:
                pass

    def publish(self, event: dict) -> None:
        payload = json.dumps(event)
        with self._lock:
            dead: list[queue.Queue] = []
            for q in self._queues:
                try:
                    q.put_nowait(payload)
                except queue.Full:
                    dead.append(q)
            for q in dead:
                self._queues.remove(q)


_bus = _EventBus()


def subscribe_sse() -> queue.Queue:
    """Subscribe a new SSE client. Returns a queue that yields JSON strings."""
    return _bus.subscribe()


def unsubscribe_sse(q: queue.Queue) -> None:
    _bus.unsubscribe(q)


# ── FolderMonitor ─────────────────────────────────────────────────────────────

class FolderMonitor:
    """
    Monitors a single folder for two livery files and deploys them to iRacing
    on creation / modification.

    Parameters
    ----------
    folder_path   : Directory to watch (user-selected via folder picker).
    customer_id   : iRacing customer ID — used to build the target filename.
    car_name      : Car folder name, e.g. ``fordmustanggt3``.
    deploy_fn     : Callable(tga_path, car_name, customer_id) → Path
    deploy_spec_fn: Callable(tga_path, car_name, customer_id) → Path
    """

    def __init__(
        self,
        folder_path: str,
        customer_id: str,
        car_name: str,
        deploy_fn: Callable,
        deploy_spec_fn: Callable,
    ) -> None:
        self.folder = Path(folder_path)
        self.customer_id = str(customer_id)
        self.car_name = car_name
        self._deploy_fn = deploy_fn
        self._deploy_spec_fn = deploy_spec_fn

        # Files to watch
        self._diffuse_name = f"car_{customer_id}.tga"
        self._spec_name = f"car_spec_{customer_id}.tga"
        self._diffuse_path = self.folder / self._diffuse_name
        self._spec_path = self.folder / self._spec_name

        # Last known mtimes (None = file didn't exist at last check)
        self._diffuse_mtime: float | None = None
        self._spec_mtime: float | None = None

        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    # ── public API ─────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the background polling thread and do an immediate initial deploy."""
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        # Snapshot current mtimes so we only react to *changes* after this point
        self._diffuse_mtime = self._mtime(self._diffuse_path)
        self._spec_mtime    = self._mtime(self._spec_path)

        # Initial deploy for any files that already exist
        self._initial_deploy()

        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()
        logger.info(
            "[monitor] Started watching %s for %s / %s → car: %s",
            self.folder,
            self._diffuse_name,
            self._spec_name,
            self.car_name,
        )

    def stop(self) -> None:
        """Stop the polling thread."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        logger.info("[monitor] Stopped watching %s", self.folder)

    @property
    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def to_dict(self) -> dict:
        return {
            "folder": str(self.folder),
            "customer_id": self.customer_id,
            "car_name": self.car_name,
            "diffuse_file": self._diffuse_name,
            "spec_file": self._spec_name,
            "running": self.is_running,
        }

    # ── internals ──────────────────────────────────────────────────────────

    @staticmethod
    def _mtime(path: Path) -> float | None:
        try:
            return path.stat().st_mtime
        except FileNotFoundError:
            return None

    def _initial_deploy(self) -> None:
        """Deploy both files if they exist at monitor start."""
        if self._diffuse_path.exists():
            self._do_deploy(self._diffuse_path, kind="diffuse", reason="initial")
        if self._spec_path.exists():
            self._do_deploy(self._spec_path, kind="spec", reason="initial")

    def _poll_loop(self) -> None:
        while not self._stop_event.wait(POLL_INTERVAL):
            self._check_file(self._diffuse_path, "diffuse")
            self._check_file(self._spec_path, "spec")

    def _check_file(self, path: Path, kind: str) -> None:
        new_mtime = self._mtime(path)
        old_attr = f"_{kind}_mtime"
        old_mtime = getattr(self, old_attr)

        if new_mtime is None:
            setattr(self, old_attr, None)
            return

        if old_mtime is None or new_mtime != old_mtime:
            setattr(self, old_attr, new_mtime)
            if old_mtime is not None:  # skip the very first detection after start
                self._do_deploy(path, kind=kind, reason="changed")

    def _do_deploy(self, path: Path, *, kind: str, reason: str) -> None:
        try:
            if kind == "spec":
                dest = self._deploy_spec_fn(str(path), self.car_name, self.customer_id)
            else:
                dest = self._deploy_fn(str(path), self.car_name, self.customer_id)

            label = "Diffuse" if kind == "diffuse" else "Specular"
            msg = f"{label} auto-deployed to iRacing ({reason})"
            logger.info("[monitor] %s → %s", path.name, dest)

            _bus.publish({
                "type": "monitor_deploy",
                "kind": kind,
                "reason": reason,
                "file": path.name,
                "dest": str(dest),
                "message": msg,
                "car": self.car_name,
                "customer_id": self.customer_id,
            })
        except Exception as exc:
            logger.error("[monitor] Deploy failed for %s: %s", path, exc)
            _bus.publish({
                "type": "monitor_error",
                "kind": kind,
                "file": path.name,
                "message": f"Auto-deploy failed: {exc}",
                "car": self.car_name,
            })


# ── Singleton monitor state ───────────────────────────────────────────────────

_current_monitor: FolderMonitor | None = None
_monitor_lock = threading.Lock()


def get_monitor() -> FolderMonitor | None:
    return _current_monitor


def start_monitor(
    folder_path: str,
    customer_id: str,
    car_name: str,
    deploy_fn: Callable,
    deploy_spec_fn: Callable,
) -> FolderMonitor:
    global _current_monitor
    with _monitor_lock:
        if _current_monitor and _current_monitor.is_running:
            _current_monitor.stop()
        _current_monitor = FolderMonitor(
            folder_path=folder_path,
            customer_id=customer_id,
            car_name=car_name,
            deploy_fn=deploy_fn,
            deploy_spec_fn=deploy_spec_fn,
        )
        _current_monitor.start()
        return _current_monitor


def stop_monitor() -> None:
    global _current_monitor
    with _monitor_lock:
        if _current_monitor:
            _current_monitor.stop()
            _current_monitor = None

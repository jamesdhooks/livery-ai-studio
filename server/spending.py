"""
server/spending.py
------------------
Persistent spending log — records every generation transaction regardless of
whether it succeeded, failed, or was cancelled.  This is the single source of
truth for cost tracking.  History TGA files are the source of truth for liveries.

Log format (data/spending_log.json):
  {
    "entries": [
      {
        "id":        "1712345678.123",    // Unix timestamp string (unique ID)
        "ts":        1712345678.123,      // Unix timestamp float
        "iso":       "2025-04-05T12:01:18",
        "model":     "Flash",             // "Flash" | "Pro"
        "resolution": "1K",              // "1K" | "2K"
        "cost":      0.067,              // actual cost if known, else estimated
        "estimated": true,               // true if cost came from client estimate
        "status":    "success",          // "success" | "failed" | "cancelled"
        "car":       "bmw_m4_gt3_evo",
        "livery_id": "bmw_m4_gt3_evo_20250405_120118"  // stem of TGA (success only)
      },
      ...
    ]
  }
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from server.config import get_data_dir, get_liveries_dir


def _log_path() -> Path:
    p = get_data_dir() / "spending_log.json"
    return p


def _load() -> dict:
    p = _log_path()
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"entries": []}


def _save(data: dict) -> None:
    p = _log_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2), encoding="utf-8")


def record(
    *,
    cost: float,
    model: str,
    resolution: str,
    status: Literal["success", "failed", "cancelled"],
    car: str = "",
    livery_id: str = "",
    estimated: bool = False,
) -> dict:
    """Append a transaction to the spending log and return the entry."""
    ts = time.time()
    entry = {
        "id":         str(ts),
        "ts":         ts,
        "iso":        datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
        "model":      model,
        "resolution": resolution,
        "cost":       cost,
        "estimated":  estimated,
        "status":     status,
        "car":        car,
        "livery_id":  livery_id,
    }
    data = _load()
    data["entries"].append(entry)
    _save(data)
    return entry


def backfill_from_history() -> bool:
    """
    One-time migration: seed the spending log from existing sidecar JSON files
    in the liveries directory.  Runs only if the log is currently empty.
    Returns True if any entries were added.
    """
    data = _load()
    if data.get("entries"):
        return False  # already populated — skip

    try:
        liveries_dir = get_liveries_dir()
    except Exception as e:
        print(f"[spending] Error getting liveries_dir: {e}")
        return False

    if not liveries_dir.exists():
        print(f"[spending] Liveries dir does not exist: {liveries_dir}")
        return False

    entries: list[dict] = []
    json_files = list(liveries_dir.glob("*.json"))
    print(f"[spending] Found {len(json_files)} JSON sidecars in {liveries_dir}")
    
    for json_file in sorted(json_files):
        try:
            sidecar = json.loads(json_file.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[spending] Failed to read {json_file.name}: {e}")
            continue

        cost = float(sidecar.get("cost") or sidecar.get("estimated_cost") or 0)
        if cost <= 0:
            continue

        # Parse timestamp from sidecar or fall back to file mtime
        ts: float = 0.0
        generated_at = sidecar.get("generated_at") or sidecar.get("timestamp")
        if generated_at:
            try:
                ts = datetime.fromisoformat(str(generated_at)).timestamp()
            except Exception:
                pass
        if not ts:
            ts = json_file.stat().st_mtime

        model_raw = sidecar.get("model") or sidecar.get("model_name") or ""
        model = "Pro" if "pro" in model_raw.lower() else "Flash"
        resolution = "2K" if sidecar.get("resolution_2k") or "2k" in str(sidecar.get("resolution", "")).lower() else "1K"

        entries.append({
            "id":         str(ts),
            "ts":         ts,
            "iso":        datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
            "model":      model,
            "resolution": resolution,
            "cost":       cost,
            "estimated":  True,  # these are historical estimates
            "status":     "success",
            "car":        sidecar.get("car") or sidecar.get("car_folder") or "",
            "livery_id":  json_file.stem,
        })

    if not entries:
        return False

    # Sort oldest-first so the log reads chronologically
    entries.sort(key=lambda e: e["ts"])
    data["entries"] = entries
    _save(data)
    print(f"[spending] Backfilled {len(entries)} entries from history sidecars.")
    return True


def get_all() -> list[dict]:
    """Return all entries (newest first)."""
    return list(reversed(_load().get("entries", [])))


def get_total(filter_id: str = "overall") -> float:
    """Return total spend across entries matching filter_id."""
    entries = _load().get("entries", [])
    now = time.time()
    if filter_id == "today":
        cutoff = now - 86_400
    elif filter_id == "week":
        cutoff = now - 7 * 86_400
    else:
        cutoff = 0.0
    return sum(e["cost"] for e in entries if e["ts"] >= cutoff)

"""Direction-aware RFID scan state.

Poll response contract (used by frontend ``bridgeFetch``):
    {
        "status": "waiting" | "success" | "timeout" | "error",
        "uid": "<card uid>",          # empty when not success
        "message": "<optional text>", # populated for timeout/error
        "enabled": bool,
        "timestamp": <epoch seconds>,
        "direction": "in" | "out",
    }

``status`` is derived from internal ``{enabled, uid, timestamp}`` so the
frontend does not need to compute the timeout itself.
"""
from __future__ import annotations

import threading
import time

DEFAULT_SCAN_TIMEOUT_SECONDS = 30.0


class RfidScanner:
    def __init__(self, timeout_seconds: float = DEFAULT_SCAN_TIMEOUT_SECONDS):
        self._lock = threading.Lock()
        self.timeout_seconds = float(timeout_seconds)
        self._state = {
            "in": {"enabled": False, "uid": "", "timestamp": 0.0},
            "out": {"enabled": False, "uid": "", "timestamp": 0.0},
        }

    def start(self, direction: str = "in"):
        self._validate(direction)
        with self._lock:
            self._state[direction] = {
                "enabled": True,
                "uid": "",
                "timestamp": time.time(),
            }

    def cancel(self, direction: str = "in"):
        self._validate(direction)
        with self._lock:
            self._state[direction]["enabled"] = False
            self._state[direction]["uid"] = ""
            self._state[direction]["timestamp"] = time.time()

    def record(self, direction: str, uid: str):
        self._validate(direction)
        uid = (uid or "").strip()
        if not uid:
            raise ValueError("uid is required")
        with self._lock:
            self._state[direction].update(
                {"uid": uid, "timestamp": time.time(), "enabled": False}
            )

    def poll(self, direction: str = "in") -> dict:
        self._validate(direction)
        with self._lock:
            raw = dict(self._state[direction])
        return self._compose_response(direction, raw)

    def _compose_response(self, direction: str, raw: dict) -> dict:
        enabled = bool(raw.get("enabled"))
        uid = raw.get("uid") or ""
        timestamp = float(raw.get("timestamp") or 0.0)
        now = time.time()
        if uid:
            status = "success"
            message = ""
        elif enabled and timestamp > 0 and (now - timestamp) > self.timeout_seconds:
            status = "timeout"
            message = "Het thoi gian quet the"
        elif enabled:
            status = "waiting"
            message = "Dang cho quet the"
        else:
            status = "waiting"
            message = ""
        return {
            "status": status,
            "uid": uid,
            "message": message,
            "enabled": enabled,
            "timestamp": timestamp,
            "direction": direction,
        }

    def state(self, direction: str = "in") -> dict:
        """Raw state (enabled, uid, timestamp) for diagnostics."""
        self._validate(direction)
        with self._lock:
            return dict(self._state[direction])

    @staticmethod
    def _validate(direction: str):
        if direction not in {"in", "out"}:
            raise ValueError("direction must be 'in' or 'out'")

"""Shared runtime state. Keep mutable process state in one place."""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any

@dataclass
class RuntimeState:
    frames: dict[str, Any] = field(default_factory=lambda: {"in": None, "out": None})
    detected_plates: dict[str, str] = field(default_factory=lambda: {"in": "", "out": ""})
    snapshots: dict[str, str] = field(default_factory=lambda: {"in": "", "out": ""})
    # YOLO boxes cho MJPEG preview; không dùng để quyết định nghiệp vụ.
    detections: dict[str, list[dict[str, Any]]] = field(
        default_factory=lambda: {"in": [], "out": []}
    )
    barrier_open: dict[str, bool] = field(default_factory=lambda: {"in": False, "out": False})
    locks: dict[str, threading.Lock] = field(default_factory=lambda: {
        "in": threading.Lock(), "out": threading.Lock(), "serial": threading.Lock()
    })

state = RuntimeState()

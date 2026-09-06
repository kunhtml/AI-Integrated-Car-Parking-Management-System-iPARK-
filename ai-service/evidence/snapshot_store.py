"""Full-frame camera evidence storage."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import re

import cv2

from config import SNAPSHOT_DIR

class SnapshotStore:
    def __init__(self, directory: Path = SNAPSHOT_DIR):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _safe(value: str) -> str:
        return re.sub(r"[^A-Za-z0-9_-]", "", value or "") or "nopl"

    def save_full_frame(self, frame, direction: str, plate: str) -> str:
        direction = direction if direction in {"in", "out"} else "in"
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        filename = f"{direction}_{stamp}_{self._safe(plate)}_full.jpg"
        path = self.directory / filename
        if frame is None or not cv2.imwrite(str(path), frame):
            return ""
        return f"/static/snapshots/{filename}"

"""YOLO detector adapter. Heavy model loading is isolated here.

Hỗ trợ 2 backend:
  - YOLO_BACKEND=openvino (mặc định) -> dùng OpenVINO IR + postprocess NumPy
  - YOLO_BACKEND=ultralytics         -> dùng PyTorch + Ultralytics (gốc)
"""
from __future__ import annotations

import os
import time
from pathlib import Path

from config import YOLO_MODEL_PATH, TORCH_NUM_THREADS, YOLO_VERBOSE

YOLO_BACKEND = os.getenv("YOLO_BACKEND", "openvino").strip().lower()


class YoloDetector:
    def __init__(self, model_path=YOLO_MODEL_PATH):
        self.model = None
        self.model_path = Path(model_path)
        self._last_no_box_log = 0.0
        self._backend_name = YOLO_BACKEND

        if self._backend_name == "openvino":
            try:
                from .openvino_yolo import OpenVinoYoloDetector
                self._ov = OpenVinoYoloDetector(self.model_path)
                self.model = self._ov  # type: ignore[assignment]
                self._backend_name = "openvino"
            except Exception as exc:
                print(f"[YOLO] openvino backend init failed ({exc}); fallback to ultralytics")
                self._init_ultralytics()
        else:
            self._init_ultralytics()

    # ------------------------------------------------------------------
    def _init_ultralytics(self) -> None:
        try:
            import torch
            from ultralytics import YOLO
            torch.set_num_threads(TORCH_NUM_THREADS)
            if not self.model_path.exists():
                raise FileNotFoundError(f"model file not found: {self.model_path}")
            self.model = YOLO(str(self.model_path))
            self._backend_name = "ultralytics"
            print(f"[YOLO] Loaded (ultralytics) from {self.model_path}")
        except Exception as exc:
            print(f"[YOLO] disabled ({self.model_path}): {exc}")
            self.model = None

    # ------------------------------------------------------------------
    def detect(self, frame) -> list[dict]:
        if self.model is None or frame is None:
            return []
        if self._backend_name == "openvino":
            return self.model.detect(frame)  # type: ignore[union-attr]
        # ultralytics
        results = self.model(frame, verbose=YOLO_VERBOSE)  # type: ignore[union-attr]
        boxes = []
        for result in results:
            for box in result.boxes:
                xyxy = box.xyxy[0].tolist()
                boxes.append({
                    "x1": int(xyxy[0]),
                    "y1": int(xyxy[1]),
                    "x2": int(xyxy[2]),
                    "y2": int(xyxy[3]),
                    "confidence": float(box.conf[0]),
                })
        if not boxes:
            now = time.time()
            if now - self._last_no_box_log >= 5:
                print("[YOLO] no plate box detected")
                self._last_no_box_log = now
        return boxes

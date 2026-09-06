"""Centralized configuration for the iPARK AI service."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
SNAPSHOT_DIR = STATIC_DIR / "snapshots"
FLASK_PORT = int(os.getenv("FLASK_PORT", "5050"))
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000").rstrip("/")
SERVICE_TOKEN = os.getenv("BRIDGE_SERVICE_TOKEN", "dev_bridge_token_change_me")
# OpenCV index trên máy hiện tại: camera vào = USB cam index 2, camera ra = USB cam index 0.
# Có thể ghi đè bằng CAMERA_IN_INDEX/CAMERA_OUT_INDEX khi đổi cổng USB.
CAMERA_IN_INDEX = int(os.getenv("CAMERA_IN_INDEX", os.getenv("CAMERA_INDEX_IN", "2")))
CAMERA_OUT_INDEX = int(os.getenv("CAMERA_OUT_INDEX", os.getenv("CAMERA_INDEX_OUT", "0")))
ESP32_IN_PORT = os.getenv("ESP32_IN_PORT", os.getenv("SERIAL_PORT_IN", "COM3"))
ESP32_OUT_PORT = os.getenv("ESP32_OUT_PORT", os.getenv("SERIAL_PORT_OUT", "COM5"))
SERIAL_BAUDRATE = int(os.getenv("SERIAL_BAUDRATE", "115200"))
OCR_ENABLED = os.getenv("OCR_ENABLED", "true").lower() not in {"0", "false", "no", "off"}
PLATE_DETECTOR = os.getenv("PLATE_DETECTOR", "yolo").lower()
# Model biển số đang dùng cho modular runtime. Có thể ghi đè bằng YOLO_MODEL_PATH.
YOLO_MODEL_PATH = Path(
    os.getenv("YOLO_MODEL_PATH", str(BASE_DIR / "license_plate_yolov26.pt"))
).expanduser()
GATE_AUTO_CLOSE_SECONDS = float(os.getenv("GATE_AUTO_CLOSE_SECONDS", "5"))
# Khoảng nghỉ tối thiểu giữa hai lần suy luận cho mỗi camera.
AI_INFERENCE_INTERVAL_SEC = float(os.getenv("AI_INFERENCE_INTERVAL_SEC", "1.0"))
# Cổng ra là điểm chặn thanh toán/barie nên được xử lý trước và thường xuyên
# hơn cổng vào. Cả hai vẫn dùng cùng một worker để không tăng peak RAM/CPU.
AI_ENTRY_INFERENCE_INTERVAL_SEC = float(
    os.getenv("AI_ENTRY_INFERENCE_INTERVAL_SEC", str(AI_INFERENCE_INTERVAL_SEC))
)
AI_EXIT_INFERENCE_INTERVAL_SEC = float(
    os.getenv("AI_EXIT_INFERENCE_INTERVAL_SEC", "0.35")
)
YOLO_VERBOSE = os.getenv("YOLO_VERBOSE", "false").lower() in {"1", "true", "yes", "on"}
CV_NUM_THREADS = int(os.getenv("CV_NUM_THREADS", "2"))
TORCH_NUM_THREADS = int(os.getenv("TORCH_NUM_THREADS", "2"))

SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

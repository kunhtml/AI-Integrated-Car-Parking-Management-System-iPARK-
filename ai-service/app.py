"""
smart_parking_rut_gon — Phiên bản tích hợp với iPARK Backend (Node.js + MongoDB).

Thay vì dùng SQLite local, service này gọi REST API của backend thông qua
service token (X-Service-Token header). Tất cả dữ liệu thẻ RFID và log
xe vào/ra được lưu trữ trong MongoDB `bai-do-xe`.

Cấu hình (đặt trong file .env hoặc biến môi trường):
- BACKEND_URL: URL của Node backend, mặc định http://localhost:4000
- BRIDGE_SERVICE_TOKEN: token dùng để xác thực với backend
"""

import os
import sys
from dotenv import load_dotenv

# Load .env nằm cùng thư mục với app.py (không phụ thuộc cwd khi chạy).
# PHẢI chạy trước khi import cv2/torch để các biến giới hạn thread có tác dụng.
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# ================== GIỚI HẠN THREAD (CHỐNG LAG) ==================
# torch/OpenBLAS/MKL mặc định dùng HẾT số core logic -> EasyOCR đẩy CPU lên
# ~100% và làm cả máy lag. Các biến này PHẢI được set TRƯỚC khi numpy/torch
# được import, nếu không thread pool đã khởi tạo và không đổi được nữa.
_TORCH_THREADS = os.getenv("TORCH_NUM_THREADS", "2")
for _var in (
    "OMP_NUM_THREADS",
    "MKL_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "NUMEXPR_NUM_THREADS",
):
    os.environ.setdefault(_var, _TORCH_THREADS)

# OCR_ENABLED=false -> KHÔNG import paddle/torch. Dùng để test camera thuần.
OCR_ENABLED = os.getenv("OCR_ENABLED", "true").strip().lower() not in (
    "0", "false", "no", "off",
)
# yolo = YOLO detect bbox + PaddleOCR (nặng, chính xác hơn)
# opencv = OpenCV contour tìm vùng biển + PaddleOCR (nhẹ, không load Torch/Ultralytics)
# fullframe = PaddleOCR toàn frame, không detect bbox trước
PLATE_DETECTOR = os.getenv("PLATE_DETECTOR", "yolo").strip().lower()
if PLATE_DETECTOR not in ("yolo", "opencv", "fullframe"):
    PLATE_DETECTOR = "yolo"
YOLO_NEEDED = OCR_ENABLED and PLATE_DETECTOR == "yolo"

import cv2
import gc
import re
import time
import serial
import threading
import requests
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from flask import Flask, Response, jsonify, request

torch = None
YOLO = None
ERROR_PLACEHOLDER_MARKER_A = 1
ERROR_PLACEHOLDER_MARKER_B = 2
ERROR_PLACEHOLDER_MARKER_C = 3
ERROR_PLACEHOLDER_MARKER_D = 4
ERROR_PLACEHOLDER_MARKER_E = 5
ERROR_PLACEHOLDER_MARKER_F = 6
ERROR_PLACEHOLDER_MARKER_G = 7
ERROR_PLACEHOLDER_MARKER_H = 8
ERROR_PLACEHOLDER_MARKER_I = 9
ERROR_PLACEHOLDER_MARKER_J = 10

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=FLASK_PORT)

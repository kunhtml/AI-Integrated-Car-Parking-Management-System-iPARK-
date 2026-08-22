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
PaddleOCR = None
paddle_ocr = None

if OCR_ENABLED:
    # Windows: import Torch TRƯỚC PaddlePaddle. Paddle nạp OpenMP/BLAS trước
    # sẽ làm torch/lib/shm.dll fail với WinError 127.
    if YOLO_NEEDED:
        try:
            import torch
            from ultralytics import YOLO
            try:
                torch.set_num_threads(int(_TORCH_THREADS))
            except Exception:
                pass
            print("[OCR] Torch + Ultralytics loaded")
        except Exception as e:
            torch = None
            YOLO = None
            PLATE_DETECTOR = "opencv"
            YOLO_NEEDED = False
            print(
                f"[OCR][ERROR] cannot load Torch/YOLO: {type(e).__name__}: {e}\n"
                f"[OCR] Fallback detector=opencv (no YOLO). "
                f"Fix: reinstall torch CPU or close apps locking VC++ DLLs."
            )

    # PaddleOCR sau Torch — latin A-Z/0-9 đủ biển VN.
    try:
        from paddleocr import PaddleOCR
    except Exception as e:
        PaddleOCR = None
        print(f"[OCR][ERROR] cannot load PaddleOCR: {type(e).__name__}: {e}")

    if YOLO_NEEDED and torch is not None:
        print("[OCR] mode=yolo — Torch + Ultralytics + PaddleOCR")
    else:
        print(f"[OCR] mode={PLATE_DETECTOR} — PaddleOCR only (no Torch/YOLO)")
else:
    print("[OCR] DISABLED (OCR_ENABLED=false) — chỉ chạy camera, không nhận biển số.")
try:
    # OpenCV cũng tự parallel hoá resize/cvtColor; giới hạn để nhường CPU.
    cv2.setNumThreads(int(os.getenv("CV_NUM_THREADS", "2")))
except Exception:
    pass

# Chặn OpenCV spam warning liên tục khi camera fail (MSMF/DSHOW backend).
# -1072875772 (0xC00D3704) là HRESULT của MSMF grab frame fail; nó sẽ
# spam ~100 dòng/giây nếu camera chưa sẵn sàng, làm tràn log và đốt CPU.
# Lưu ý: setLogLevel(2)=ERROR chỉ ẩn ERROR+; MSMF grab fail log ở WARN(3).
# Phải setLogLevel(0)=SILENT để ẩn tất cả.
os.environ.setdefault("OPENCV_LOG_LEVEL", "SILENT")
try:
    cv2.setLogLevel(0)  # 0 = SILENT (ẩn WARN/ERROR/FATAL/INFO/DEBUG)
except Exception:
    pass

# Fix UnicodeEncodeError trên Windows console (cp1252 mặc định)
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# ================== CONFIG ==================
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000")
BRIDGE_SERVICE_TOKEN = os.getenv(
    "BRIDGE_SERVICE_TOKEN",
    "ipark-bridge-token-2026-change-me-in-production",
)
SERIAL_PORT_IN = os.getenv("SERIAL_PORT_IN", os.getenv("ESP32_IN_PORT", "COM3"))
SERIAL_PORT_OUT = os.getenv("SERIAL_PORT_OUT", os.getenv("ESP32_OUT_PORT", "COM5"))
CAMERA_INDEX_IN = int(os.getenv("CAMERA_INDEX_IN", "0"))
CAMERA_INDEX_OUT = int(os.getenv("CAMERA_INDEX_OUT", "1"))
# Chọn camera theo TÊN DirectShow (khuyến nghị trên Windows).
# Index OpenCV KHÔNG khớp thứ tự pygrabber/Device Manager — dễ dính webcam laptop.
# Nếu 2 cam trùng tên (cả hai "USB2.0 PC CAMERA"), dùng ordinal:
#   CAMERA_NAME_IN=USB2.0 PC CAMERA
#   CAMERA_NAME_ORDINAL_IN=0
#   CAMERA_NAME_OUT=USB2.0 PC CAMERA
#   CAMERA_NAME_ORDINAL_OUT=1
# CAMERA_EXCLUDE: bỏ qua thiết bị có chuỗi này trong tên (vd. ACER,User Facing)
CAMERA_NAME_IN = os.getenv("CAMERA_NAME_IN", "").strip()
CAMERA_NAME_OUT = os.getenv("CAMERA_NAME_OUT", "").strip()
CAMERA_NAME_ORDINAL_IN = int(os.getenv("CAMERA_NAME_ORDINAL_IN", "0"))
CAMERA_NAME_ORDINAL_OUT = int(os.getenv("CAMERA_NAME_ORDINAL_OUT", "0"))
CAMERA_EXCLUDE = os.getenv("CAMERA_EXCLUDE", "ACER,User Facing").strip()
# Backend camera trên Windows. DSHOW (DirectShow) ổn định hơn MSMF cho
# webcam thường — MSMF hay spam warning + grab fail khi nguồn chưa sẵn sàng.
# Set CAMERA_BACKEND=MSMF/FFMPEG/ANY nếu thiết bị yêu cầu backend khác.
CAMERA_BACKEND = os.getenv("CAMERA_BACKEND", "DSHOW").upper()
_BACKEND_MAP = {
    "DSHOW": cv2.CAP_DSHOW,
    "MSMF": cv2.CAP_MSMF,
    "FFMPEG": cv2.CAP_FFMPEG,
    "ANY": cv2.CAP_ANY,
}
_OPEN_BACKEND = _BACKEND_MAP.get(CAMERA_BACKEND, cv2.CAP_DSHOW)

# ================== CAMERA LIVE PREVIEW ==================
# OCR chạy realtime mỗi loop (không ghi disk).
# Live preview (cam_in.jpg / cam_out.jpg) chỉ ghi theo interval để giảm I/O và
# tránh "chụp ảnh liên tục" gây nặng đĩa.
# Snapshot đính kèm session chỉ ghi khi có RFID scan / DATA log từ ESP32.
LIVE_PREVIEW_INTERVAL_SEC = float(os.getenv("LIVE_PREVIEW_INTERVAL_SEC", "1.0"))

# ================== HIỆU NĂNG (CHỐNG LAG) ==================
# EasyOCR chạy CPU tốn 200-800ms/frame. Nếu OCR mỗi vòng lặp cho cả 2 camera
# thì CPU bị đốt 100% liên tục -> máy lag, stream giật.
# OCR_INTERVAL_SEC: khoảng cách tối thiểu giữa 2 lần OCR của MỖI camera.
# Frame vẫn được đọc liên tục cho preview/stream, chỉ OCR là bị điều tiết.
# 2.0s cho mỗi camera: 2 camera = OCR 1 lần/giây tổng. EasyOCR 200-800ms/frame
# trên CPU i5 thường; interval dài hơn 2s nếu CPU yếu (set biến môi trường).
OCR_INTERVAL_SEC = float(os.getenv("OCR_INTERVAL_SEC", "0.5"))
# Hạ chiều rộng ảnh trước khi OCR (0 = không hạ). Thời gian OCR ~ số pixel.
OCR_MAX_WIDTH = int(os.getenv("OCR_MAX_WIDTH", "480"))
# FPS tối đa của MJPEG stream. 12fps cân bằng mượt/CPU cho MJPEG qua HTTP
# (15-20fps không cải thiện cảm nhận vì MJPEG đã có latency 100-300ms do HTTP).
MJPEG_FPS = float(os.getenv("MJPEG_FPS", "12"))
# Chất lượng JPEG cho stream. 65 là điểm ngọt — thấp hơn gây blockiness,
# cao hơn đốt CPU encode mà mắt thường không phân biệt ở 640px.
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "65"))
# Nghỉ giữa 2 vòng camera_loop (giây). 0.03 (~33fps đọc) — OCR thread
# chạy song song nên loop chính vẫn cần tick nhanh để last_frame cập nhật
# kịp cho MJPEG stream. KHÔNG tăng lên — sẽ gây giật stream.
CAMERA_LOOP_SLEEP = float(os.getenv("CAMERA_LOOP_SLEEP", "0.03"))
# Giảm độ phân giải stream để giảm CPU encode JPEG. 480px đủ cho giám sát
# biển số và giảm ~50% thời gian encode so với 640px.
STREAM_MAX_WIDTH = int(os.getenv("STREAM_MAX_WIDTH", "480"))
# Khoảng cách tối thiểu giữa 2 lần ACCEPT cùng 1 biển số (giây).
# Tránh spam khi xe đứng trước camera (YOLO detect liên tục).
# 5s đủ để xe đi qua hoặc tài xế dừng lại check-in.
PLATE_COOLDOWN_SEC = float(os.getenv("PLATE_COOLDOWN_SEC", "5.0"))

# ================== RAM / OCR SCHEDULER ==================
# legacy = 1 thread OCR mỗi camera (cũ, dễ OOM khi 2 cam cùng inference)
# single-worker = 1 AI worker + 1-slot latest-frame mỗi hướng
OCR_SCHEDULER_MODE = os.getenv("OCR_SCHEDULER_MODE", "single-worker").strip().lower()
if OCR_SCHEDULER_MODE not in ("legacy", "single-worker"):
    OCR_SCHEDULER_MODE = "single-worker"
# Giới hạn chiều rộng frame đưa vào YOLO (0 = giữ nguyên). Scale bbox về ảnh gốc sau detect.
YOLO_MAX_WIDTH = int(os.getenv("YOLO_MAX_WIDTH", "640"))
# imgsz truyền vào ultralytics YOLO predict
YOLO_IMGSZ = int(os.getenv("YOLO_IMGSZ", "640"))
# OpenCV plate-candidate finder (khi PLATE_DETECTOR=opencv)
OPENCV_PLATE_MAX_CANDIDATES = max(1, int(os.getenv("OPENCV_PLATE_MAX_CANDIDATES", "5")))
OPENCV_PLATE_MIN_AREA_RATIO = float(os.getenv("OPENCV_PLATE_MIN_AREA_RATIO", "0.002"))
OPENCV_PLATE_MAX_AREA_RATIO = float(os.getenv("OPENCV_PLATE_MAX_AREA_RATIO", "0.25"))
OPENCV_PLATE_MIN_ASPECT = float(os.getenv("OPENCV_PLATE_MIN_ASPECT", "1.5"))
OPENCV_PLATE_MAX_ASPECT = float(os.getenv("OPENCV_PLATE_MAX_ASPECT", "6.0"))
# Chỉ ghi snapshot khi có biển số hợp lệ (true) hoặc ngay khi YOLO có bbox (false)
SNAPSHOT_ON_VALID_PLATE_ONLY = os.getenv(
    "SNAPSHOT_ON_VALID_PLATE_ONLY", "true"
).strip().lower() not in ("0", "false", "no", "off")
# Soft-limit RSS (MB). 0 = tắt. Vượt ngưỡng → tạm dừng submit OCR.
AI_MEMORY_SOFT_LIMIT_MB = int(os.getenv("AI_MEMORY_SOFT_LIMIT_MB", "0"))
AI_MEMORY_COOLDOWN_SEC = float(os.getenv("AI_MEMORY_COOLDOWN_SEC", "30"))
# Background HTTP/lookup pool — tránh Thread() không giới hạn
BACKGROUND_WORKER_COUNT = max(1, int(os.getenv("BACKGROUND_WORKER_COUNT", "2")))
BACKGROUND_QUEUE_SIZE = max(1, int(os.getenv("BACKGROUND_QUEUE_SIZE", "32")))
# Log metric RAM định kỳ (giây). 0 = tắt.
AI_METRIC_INTERVAL_SEC = float(os.getenv("AI_METRIC_INTERVAL_SEC", "60"))

# Dùng đường dẫn tuyệt đối theo thư mục app.py để không phụ thuộc CWD
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(_BASE_DIR, "static")
SNAPSHOT_DIR = os.path.join(STATIC_DIR, "snapshots")

# Flask local port (cho giao diện web + RFID management UI)
FLASK_PORT = int(os.getenv("FLASK_PORT", "5050"))

# Khóa dùng chung cho mọi lần gọi YOLO/PaddleOCR trong process
_inference_lock = threading.Lock()
# Trạng thái memory-pressure (degraded)
_ai_degraded_until = 0.0
_ai_degraded_reason = ""
_ai_metrics = {
    "rss_mb": 0.0,
    "frames_dropped": 0,
    "inferences": 0,
    "last_inference_ms": 0.0,
    "bg_submitted": 0,
    "bg_dropped": 0,
    "bg_pending": 0,
    "ocr_busy": False,
    "scheduler_mode": OCR_SCHEDULER_MODE,
}

# ================== HTTP CLIENT ==================
class BackendClient:
    """Client gọi iPARK backend với service token."""

    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "X-Service-Token": token,
            "Content-Type": "application/json",
        })

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def health(self):
        try:
            r = self.session.get(self._url("/api/bridge/health"), timeout=5)
            return r.ok
        except Exception as e:
            print("[BACKEND][HEALTH] error:", e)
            return False

    def fetch_rois(self):
        """Lấy ROI từng cổng (entry/exit) từ backend — hệ 640x360 của editor."""
        try:
            r = self.session.get(self._url("/api/bridge/roi"), timeout=5)
            if r.ok:
                return r.json().get("rois") or {}
            print("[BACKEND][ROI][ERROR]", r.status_code, r.text[:200])
            return {}
        except Exception as e:
            print(f"[BACKEND][ROI][ERROR] {type(e).__name__}: {e}")
            return {}

    def rfid_export(self):
        try:
            r = self.session.get(self._url("/api/rfid-bridge/export"), timeout=10)
            if r.ok:
                return r.json().get("cards", [])
            print("[BACKEND][RFID][ERROR]", r.status_code, r.text)
            return []
        except Exception as e:
            # Backend chết/restart — KHÔNG được để thread caller crash.
            print(f"[BACKEND][RFID][ERROR] {type(e).__name__}: {e}")
            return []

    def rfid_lookup_uid(self, uid: str):
        try:
            r = self.session.get(self._url(f"/api/rfid-bridge/lookup/{uid}"), timeout=10)
            if r.ok:
                return r.json().get("card")
            return None
        except Exception as e:
            print(f"[BACKEND][RFID][LOOKUP] {type(e).__name__}: {e}")
            return None

    def rfid_lookup_plate(self, plate: str):
        try:
            r = self.session.get(self._url(f"/api/rfid-bridge/by-plate/{plate}"), timeout=10)
            if r.ok:
                return r.json()
            return {"card": None, "vehicle": None}
        except Exception as e:
            # Camera_loop gọi hàm này mỗi khi detect được biển số; nếu backend
            # chết/restart, không được để exception thoát ra làm Thread chết.
            print(f"[BACKEND][RFID][LOOKUP] {type(e).__name__}: {e}")
            return {"card": None, "vehicle": None}

    def rfid_scan_register(self, uid: str, owner_name: str = "Guest", plate: str = "", user_type: str = "guest"):
        try:
            r = self.session.post(
                self._url("/api/rfid-bridge/scan"),
                json={"uid": uid, "ownerName": owner_name, "plate": plate, "userType": user_type},
                timeout=10,
            )
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            result = {
                "ok": r.ok,
                "status_code": r.status_code,
                "created": data.get("created", False),
                "card": data.get("card"),
                "code": data.get("code"),
                "message": data.get("message", "") or data.get("error", ""),
            }
            if not r.ok:
                print(f"[BACKEND][RFID][SCAN] rejected status={r.status_code} uid={uid!r} response={data}")
            return result
        except Exception as e:
            print("[BACKEND][RFID][SCAN] error:", e)
            return {"ok": False, "created": False, "card": None, "message": str(e)}

    def push_camera_log(
        self,
        direction: str,
        detected_plate: str,
        confidence: float = 0.0,
        rfid_uid: str = None,
        owner_name: str = None,
        plate: str = None,
        user_type: str = "unknown",
        image_path: str = None,
        barrier_opened: bool = False,
        metadata: dict = None,
    ):
        try:
            payload = {
                "direction": direction,
                "detectedPlate": detected_plate,
                "confidence": confidence,
                "rfidUid": rfid_uid,
                "ownerName": owner_name,
                "plate": plate,
                "userType": user_type,
                "imagePath": image_path,
                "barrierOpened": barrier_opened,
                "metadata": metadata or {},
            }
            payload = {k: v for k, v in payload.items() if v is not None and v != ""}
            r = self.session.post(self._url("/api/bridge/log"), json=payload, timeout=10)
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            result = {
                "ok": r.ok,
                "status_code": r.status_code,
                "data": data,
                "message": data.get("message", "") or data.get("error", ""),
            }
            if not r.ok:
                print(f"[BACKEND][CAMERA][PUSH] rejected status={r.status_code} response={data}")
            return result
        except Exception as e:
            print("[BACKEND][CAMERA][ERROR]", e)
            return {"ok": False, "status_code": 0, "data": {"message": str(e)}}

    def gate_control(self, direction: str, action: str):
        try:
            r = self.session.post(self._url(f"/api/bridge/gate/{direction}/{action}"), timeout=5)
            return r.ok
        except Exception as e:
            print("[BACKEND][GATE][ERROR]", e)
            return False


backend = BackendClient(BACKEND_URL, BRIDGE_SERVICE_TOKEN)


# ================== SERIAL ==================
serial_lock_in = threading.Lock()
serial_lock_out = threading.Lock()

# ================== BACKGROUND WORKER POOL ==================
_bg_executor = ThreadPoolExecutor(
    max_workers=BACKGROUND_WORKER_COUNT,
    thread_name_prefix="ai-bg",
)
_bg_pending_sema = threading.BoundedSemaphore(BACKGROUND_QUEUE_SIZE)


def _submit_background(fn, *args, **kwargs) -> bool:
    """Chạy tác vụ nền qua pool có giới hạn. Trả False nếu queue đầy (bỏ task)."""
    global _ai_metrics
    if not _bg_pending_sema.acquire(blocking=False):
        _ai_metrics["bg_dropped"] = int(_ai_metrics.get("bg_dropped", 0)) + 1
        print(f"[BG][DROP] queue full ({BACKGROUND_QUEUE_SIZE}), skip {getattr(fn, '__name__', fn)}")
        return False

    def _runner():
        try:
            fn(*args, **kwargs)
        except Exception as e:
            print(f"[BG][ERROR] {getattr(fn, '__name__', fn)}: {type(e).__name__}: {e}")
        finally:
            _bg_pending_sema.release()
            try:
                _ai_metrics["bg_pending"] = BACKGROUND_QUEUE_SIZE - _bg_pending_sema._value
            except Exception:
                pass

    _bg_executor.submit(_runner)
    _ai_metrics["bg_submitted"] = int(_ai_metrics.get("bg_submitted", 0)) + 1
    try:
        _ai_metrics["bg_pending"] = BACKGROUND_QUEUE_SIZE - _bg_pending_sema._value
    except Exception:
        pass
    return True


def _process_rss_mb() -> float:
    """RSS process hiện tại (MB). 0.0 nếu không đọc được."""
    try:
        import psutil  # optional
        return float(psutil.Process(os.getpid()).memory_info().rss) / (1024 * 1024)
    except Exception:
        pass
    if sys.platform.startswith("win"):
        try:
            import ctypes
            from ctypes import wintypes

            class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
                _fields_ = [
                    ("cb", wintypes.DWORD),
                    ("PageFaultCount", wintypes.DWORD),
                    ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t),
                    ("PeakPagefileUsage", ctypes.c_size_t),
                ]

            counters = PROCESS_MEMORY_COUNTERS()
            counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
            handle = ctypes.windll.kernel32.GetCurrentProcess()
            if ctypes.windll.psapi.GetProcessMemoryInfo(
                handle, ctypes.byref(counters), counters.cb
            ):
                return float(counters.WorkingSetSize) / (1024 * 1024)
        except Exception:
            pass
    try:
        with open("/proc/self/status", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    parts = line.split()
                    return float(parts[1]) / 1024.0
    except Exception:
        pass
    return 0.0


def _set_memory_degraded(reason: str, cooldown_sec: float | None = None) -> None:
    global _ai_degraded_until, _ai_degraded_reason
    cd = AI_MEMORY_COOLDOWN_SEC if cooldown_sec is None else cooldown_sec
    _ai_degraded_until = time.time() + max(1.0, cd)
    _ai_degraded_reason = reason or "memory-pressure"
    print(f"[AI][DEGRADED] reason={_ai_degraded_reason} cooldown={cd:.0f}s")


def _is_ai_degraded() -> bool:
    return time.time() < _ai_degraded_until


def _check_memory_pressure() -> bool:
    """True nếu đang/vừa kích hoạt degraded do vượt soft-limit."""
    global _ai_metrics
    if AI_MEMORY_SOFT_LIMIT_MB <= 0:
        return _is_ai_degraded()
    rss = _process_rss_mb()
    _ai_metrics["rss_mb"] = round(rss, 1)
    if rss >= AI_MEMORY_SOFT_LIMIT_MB:
        _set_memory_degraded("memory-pressure")
        try:
            gc.collect()
        except Exception:
            pass
        return True
    return _is_ai_degraded()


def _resize_for_yolo(frame, max_width: int):
    """Resize frame cho YOLO. Trả (frame_small, scale) với scale = small/original."""
    if frame is None or max_width <= 0:
        return frame, 1.0
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame, 1.0
    scale = max_width / float(w)
    new_w = max_width
    new_h = max(1, int(h * scale))
    small = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return small, scale


def _scale_boxes_to_original(boxes, scale: float):
    """Quy đổi bbox từ ảnh YOLO về toạ độ ảnh gốc."""
    if not boxes or scale <= 0 or abs(scale - 1.0) < 1e-9:
        return boxes
    inv = 1.0 / scale
    out = []
    for item in boxes:
        if len(item) >= 5:
            x1, y1, x2, y2, conf = item[:5]
            rest = item[5:]
            out.append((
                int(x1 * inv), int(y1 * inv), int(x2 * inv), int(y2 * inv), conf, *rest
            ))
        else:
            out.append(item)
    return out


def _dedupe_plate_boxes(boxes, iou_threshold=0.5):
    """Keep the strongest box when YOLO returns overlapping plate boxes."""
    kept = []
    for candidate in sorted(boxes, key=lambda b: b[4], reverse=True):
        x1, y1, x2, y2, _ = candidate[:5]
        area = max(1, (x2 - x1) * (y2 - y1))
        duplicate = False
        for prior in kept:
            px1, py1, px2, py2, _ = prior[:5]
            inter = max(0, min(x2, px2) - max(x1, px1)) * max(0, min(y2, py2) - max(y1, py1))
            prior_area = max(1, (px2 - px1) * (py2 - py1))
            union = area + prior_area - inter
            if (inter / union if union else 0) >= iou_threshold:
                duplicate = True
                break
        if not duplicate:
            kept.append(candidate)
    return kept


def _metric_logger_loop():
    """Log RSS + OCR metrics định kỳ."""
    while True:
        try:
            interval = AI_METRIC_INTERVAL_SEC
            if interval <= 0:
                time.sleep(30)
                continue
            time.sleep(interval)
            rss = _process_rss_mb()
            _ai_metrics["rss_mb"] = round(rss, 1)
            degraded = _is_ai_degraded()
            print(
                "[AI][METRIC] "
                f"rss_mb={rss:.1f} "
                f"dropped={_ai_metrics.get('frames_dropped', 0)} "
                f"inferences={_ai_metrics.get('inferences', 0)} "
                f"last_inf_ms={_ai_metrics.get('last_inference_ms', 0):.0f} "
                f"bg_sub={_ai_metrics.get('bg_submitted', 0)} "
                f"bg_drop={_ai_metrics.get('bg_dropped', 0)} "
                f"bg_pend={_ai_metrics.get('bg_pending', 0)} "
                f"busy={_ai_metrics.get('ocr_busy', False)} "
                f"mode={_ai_metrics.get('scheduler_mode', OCR_SCHEDULER_MODE)} "
                f"degraded={degraded}"
                + (f"({_ai_degraded_reason})" if degraded else "")
            )
            if AI_MEMORY_SOFT_LIMIT_MB > 0 and rss >= AI_MEMORY_SOFT_LIMIT_MB:
                _set_memory_degraded("memory-pressure")
        except Exception as e:
            print(f"[AI][METRIC][ERROR] {type(e).__name__}: {e}")
            time.sleep(30)


def _sanitize_field(s: str) -> str:
    return (s or "").replace("|", " ").replace("\n", " ").replace("\r", " ").strip()


def safe_write(ser, lock: threading.Lock, line: str) -> bool:
    if ser is None:
        return False
    if not line.endswith("\n"):
        line += "\n"
    try:
        with lock:
            ser.write(line.encode())
        return True
    except Exception as e:
        print("[SERIAL][ERROR] write failed:", e)
        return False


def send_to_both(line: str) -> None:
    ok_in = safe_write(arduino_in, serial_lock_in, line)
    ok_out = safe_write(arduino_out, serial_lock_out, line)
    print(f"[SERIAL][BROADCAST] {line.strip()} | IN={ok_in} OUT={ok_out}")


def _normalize_plate(plate: str) -> str:
    if not plate:
        return ""
    return plate.strip().upper().replace("-", "").replace(" ", "")


def sync_all_rfid_cards_to_esp32():
    """
    Đồng bộ toàn bộ thẻ active từ MongoDB xuống cả 2 ESP32.
    (Wrapper giữ API cũ — chỉ in log, không trả stats.)
    """
    sync_all_rfid_cards_to_esp32_with_stats()


def sync_all_rfid_cards_to_esp32_with_stats():
    """
    Đồng bộ toàn bộ thẻ active từ MongoDB xuống cả 2 ESP32.
    Trả về tuple (sent_in, sent_out) — số card THỰC SỰ được write thành công
    tới từng ESP32 (qua safe_write, không phải tổng số trong DB).
    Trả về (0, 0) nếu backend không phản hồi / exception.
    """
    sent_in = 0
    sent_out = 0
    try:
        print("[SYNC_ALL] Start sync all RFID cards to ESP32...")
        ok_in = safe_write(arduino_in, serial_lock_in, "RESET_CARDS")
        ok_out = safe_write(arduino_out, serial_lock_out, "RESET_CARDS")
        print(f"[SYNC_ALL] RESET_CARDS | IN={ok_in} OUT={ok_out}")

        cards = backend.rfid_export() or []
        if not cards:
            print("[SYNC_ALL] No cards fetched from backend (backend down or empty).")
            return (0, 0)

        for card in cards:
            uid = (card.get("uid") or "").strip()
            if not uid:
                continue
            owner = card.get("ownerName", "")
            plate = _normalize_plate(card.get("plate", ""))
            user_type = card.get("userType", "guest")
            raw_status = str(card.get("status", "active")).lower()
            status = "active" if raw_status in ("active", "in-use") else raw_status
            cmd = f"ADD|{uid}|{owner}|{plate}|{user_type}|{status}"
            if safe_write(arduino_in, serial_lock_in, cmd):
                sent_in += 1
            if safe_write(arduino_out, serial_lock_out, cmd):
                sent_out += 1
            time.sleep(0.05)

        print(f"[SYNC_ALL] Done. IN sent={sent_in} OUT sent={sent_out}.")
    except Exception as e:
        print(f"[SYNC_ALL][ERROR] {type(e).__name__}: {e}")
    return (sent_in, sent_out)


def safe_serial(port):
    try:
        ser = serial.Serial(port, 9600, timeout=1)
        print(f"[OK] Connected to {port}")
        return ser
    except serial.SerialException as e:
        print(f"[ERROR] {port} busy or unavailable: {e}")
        return None


arduino_in = safe_serial(SERIAL_PORT_IN)
arduino_out = safe_serial(SERIAL_PORT_OUT)


# ==== CẤU HÌNH CAMERA ====
def _list_dshow_device_names() -> list[str]:
    """Liệt kê tên camera DirectShow theo đúng thứ tự index OpenCV (Windows)."""
    # 1) pygrabber — map index OpenCV CAP_DSHOW chính xác nhất
    try:
        from pygrabber.dshow_graph import FilterGraph  # type: ignore

        names = list(FilterGraph().get_input_devices() or [])
        if names:
            return [str(n) for n in names]
    except Exception as e:
        print(f"[CAM] pygrabber unavailable ({type(e).__name__}: {e})")

    # 2) ffmpeg -list_devices (thứ tự thường khớp DSHOW, không luôn 100%)
    try:
        import re
        import subprocess

        r = subprocess.run(
            ["ffmpeg", "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=12,
        )
        text = (r.stderr or "") + (r.stdout or "")
        names = []
        for line in text.splitlines():
            m = re.search(r'"([^"]+)"\s*\(video\)', line)
            if m:
                names.append(m.group(1))
        if names:
            print("[CAM] device list via ffmpeg (verify against OpenCV index if wrong)")
            return names
    except Exception as e:
        print(f"[CAM] ffmpeg device list failed: {type(e).__name__}: {e}")
    return []


def _exclude_tokens() -> list[str]:
    return [t.strip().lower() for t in CAMERA_EXCLUDE.split(",") if t.strip()]


def _is_excluded_name(name: str) -> bool:
    low = (name or "").lower()
    return any(tok in low for tok in _exclude_tokens())


def _probe_index_openable(index: int, hold_ms: float = 0.25) -> bool:
    """True nếu OpenCV mở được index và đọc được ít nhất 1 frame."""
    cap = None
    try:
        cap = cv2.VideoCapture(int(index), _OPEN_BACKEND)
        if not cap.isOpened():
            return False
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass
        time.sleep(max(0.0, hold_ms))
        for _ in range(8):
            ok, frame = cap.read()
            if ok and frame is not None:
                return True
        return False
    except Exception:
        return False
    finally:
        if cap is not None:
            try:
                cap.release()
            except Exception:
                pass


def _candidate_indices_for_role(
    role: str,
    fallback_index: int,
    name_query: str,
    ordinal: int,
    devices: list[str],
) -> list[int]:
    """Danh sách index ưu tiên cho role (chưa kiểm tra openable)."""
    q = (name_query or "").strip().lower()
    if q and devices:
        matches = [
            i for i, n in enumerate(devices)
            if q in n.lower() and not _is_excluded_name(n)
        ]
        if matches:
            ord_i = max(0, int(ordinal))
            # Ưu tiên ordinal, sau đó các match còn lại
            ordered = matches[ord_i:] + matches[:ord_i]
            print(
                f"[CAM][{role}] name='{name_query}' ordinal={ord_i} "
                f"candidates={ordered} "
                f"({', '.join(devices[i] for i in ordered)})"
            )
            return ordered
        print(
            f"[CAM][{role}][WARN] không match tên '{name_query}' sau exclude. "
            f"Thử fallback/index không excluded."
        )

    # Fallback: index cấu hình, rồi mọi cam không excluded
    out: list[int] = []
    if fallback_index >= 0:
        out.append(int(fallback_index))
    if devices:
        for i, n in enumerate(devices):
            if not _is_excluded_name(n) and i not in out:
                out.append(i)
    else:
        # Không có device list — quét vài index thường gặp
        for i in range(0, 6):
            if i not in out:
                out.append(i)
    return out


def _resolve_both_camera_indices() -> tuple[int, int]:
    """
    Chọn 2 index OpenCV thực sự mở được cho IN/OUT.
    Bỏ webcam laptop (CAMERA_EXCLUDE). Không tin index "trên giấy".
    """
    devices = _list_dshow_device_names()
    if devices:
        print(f"[CAM] DirectShow devices ({len(devices)}):")
        for i, n in enumerate(devices):
            flag = " [EXCLUDED]" if _is_excluded_name(n) else ""
            print(f"[CAM]   idx {i}: {n}{flag}")

    in_cands = _candidate_indices_for_role(
        "in", CAMERA_INDEX_IN, CAMERA_NAME_IN, CAMERA_NAME_ORDINAL_IN, devices
    )
    out_cands = _candidate_indices_for_role(
        "out", CAMERA_INDEX_OUT, CAMERA_NAME_OUT, CAMERA_NAME_ORDINAL_OUT, devices
    )

    # Loại candidate bị exclude nếu biết tên
    def _ok_name(idx: int) -> bool:
        if not devices or idx < 0 or idx >= len(devices):
            return True
        return not _is_excluded_name(devices[idx])

    in_cands = [i for i in in_cands if _ok_name(i)]
    out_cands = [i for i in out_cands if _ok_name(i)]

    openable_cache: dict[int, bool] = {}

    def _openable(idx: int) -> bool:
        if idx not in openable_cache:
            ok = _probe_index_openable(idx)
            openable_cache[idx] = ok
            label = devices[idx] if devices and 0 <= idx < len(devices) else "?"
            print(f"[CAM] probe index={idx} ({label}): {'OK' if ok else 'FAIL'}")
        return openable_cache[idx]

    chosen_in = None
    for idx in in_cands:
        if _openable(idx):
            chosen_in = idx
            break

    chosen_out = None
    for idx in out_cands:
        if chosen_in is not None and idx == chosen_in:
            continue
        if _openable(idx):
            chosen_out = idx
            break

    # Nếu OUT không có cam riêng, thử mọi openable còn lại
    if chosen_out is None:
        all_try = []
        for seq in (out_cands, in_cands, list(range(0, max(6, len(devices) + 1)))):
            for idx in seq:
                if idx not in all_try:
                    all_try.append(idx)
        for idx in all_try:
            if chosen_in is not None and idx == chosen_in:
                continue
            if not _ok_name(idx):
                continue
            if _openable(idx):
                chosen_out = idx
                break

    if chosen_in is None and chosen_out is not None:
        chosen_in, chosen_out = chosen_out, None

    if chosen_in is None:
        # Bó buộc fallback — có thể là laptop nếu không còn gì
        chosen_in = CAMERA_INDEX_IN
        print(
            f"[CAM][ERROR] Không probe được camera nào. "
            f"Fallback IN={chosen_in}. Kiểm tra USB / process khác đang giữ cam."
        )
    if chosen_out is None:
        chosen_out = chosen_in
        print(
            f"[CAM][WARN] Chỉ có 1 camera OpenCV mở được. "
            f"OUT tạm dùng chung index={chosen_out}. "
            f"Thường do USB cam #2 bị process khác giữ hoặc driver không expose index."
        )

    def _label(idx: int) -> str:
        if devices and 0 <= idx < len(devices):
            return devices[idx]
        return "?"

    print(
        f"[CAM] resolved IN={chosen_in} ({_label(chosen_in)}), "
        f"OUT={chosen_out} ({_label(chosen_out)})"
    )
    return int(chosen_in), int(chosen_out)


def _open_camera(index):
    """Mở camera bằng backend chỉ định.

    Trả về None nếu không mở được — không fallback sang CAP_ANY vì CAP_ANY
    trên Windows sẽ ngầm chọn MSMF và spam warning không kiểm soát khi
    camera không tồn tại. Caller nên kiểm tra None và skip xử lý.
    """
    cap = cv2.VideoCapture(index, _OPEN_BACKEND)
    if not cap.isOpened():
        cap.release()
        print(
            f"[CAM] Cannot open camera index={index} "
            f"(backend={CAMERA_BACKEND}). Slot offline until reconnect."
        )
        return None
    # Giảm buffer nội bộ để giảm độ trễ + fail streak ngắn hơn khi reconnect.
    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass
    # Đọc thử 1 frame để log nhanh cam có tín hiệu không
    try:
        ok, frame = cap.read()
        if ok and frame is not None:
            h, w = frame.shape[:2]
            print(f"[CAM] opened index={index} frame={w}x{h} mean={float(frame.mean()):.1f}")
        else:
            print(f"[CAM] opened index={index} but first read failed (black/busy?)")
    except Exception as e:
        print(f"[CAM] opened index={index} but probe read error: {e}")
    return cap


def _safe_read(cap, retries=2):
    """Đọc frame với retry ngắn để giảm false-fail khi buffer trống."""
    if cap is None:
        return False, None
    for _ in range(retries):
        ok, frame = cap.read()
        if ok and frame is not None:
            return True, frame
    return False, None


# Resolve index một lần lúc boot (và dùng lại khi reconnect)
_CAM_INDEX_IN_RESOLVED, _CAM_INDEX_OUT_RESOLVED = _resolve_both_camera_indices()
if _CAM_INDEX_IN_RESOLVED == _CAM_INDEX_OUT_RESOLVED:
    print(
        f"[CAM][WARN] IN và OUT cùng index={_CAM_INDEX_IN_RESOLVED}. "
        f"Hai hướng dùng chung 1 camera."
    )


def _reconnect(index):
    """Thử mở lại camera; trả về cap mới hoặc None nếu vẫn fail."""
    return _open_camera(index)


print(
    f"[CAM] backend={CAMERA_BACKEND} "
    f"IN index={_CAM_INDEX_IN_RESOLVED} (cfg_index={CAMERA_INDEX_IN}, name={CAMERA_NAME_IN!r}) "
    f"OUT index={_CAM_INDEX_OUT_RESOLVED} (cfg_index={CAMERA_INDEX_OUT}, name={CAMERA_NAME_OUT!r}) "
    f"exclude={CAMERA_EXCLUDE!r}"
)
cap_in = _open_camera(_CAM_INDEX_IN_RESOLVED)
if _CAM_INDEX_OUT_RESOLVED == _CAM_INDEX_IN_RESOLVED:
    # Không share handle (2 thread đọc 1 VideoCapture → race/đen). OUT offline.
    cap_out = None
    print(
        "[CAM][WARN] OUT offline: chỉ resolve được 1 camera. "
        "Đóng app/browser khác đang giữ USB cam #2 rồi restart."
    )
else:
    cap_out = _open_camera(_CAM_INDEX_OUT_RESOLVED)

# Chỉ load PaddleOCR khi OCR được bật — model mobile ~5MB.
# use_angle_cls=False: crop biển thường đã thẳng.
# lang='en': latin A-Z/0-9 đủ biển VN, nhẹ hơn 'vi'.
paddle_ocr = PaddleOCR(use_angle_cls=False, lang='en', show_log=False) if OCR_ENABLED else None

# YOLO chỉ load khi PLATE_DETECTOR=yolo.
# PyTorch >=2.6 weights_only=True mặc định → patch load best.pt local.
YOLO_MODEL_PATH = os.path.join(_BASE_DIR, "yolo_model", "best.pt")
yolo_model = None
YOLO_CONF_THR = float(os.getenv("YOLO_CONF_THR", "0.25"))
if YOLO_NEEDED and YOLO is not None:
    try:
        import torch.serialization as _torch_ser

        _orig_torch_load = _torch_ser.load

        def _torch_load_unsafe(*args, **kwargs):
            kwargs.setdefault("weights_only", False)
            return _orig_torch_load(*args, **kwargs)

        import torch as _torch
        _torch.load = _torch_load_unsafe
        _torch_ser.load = _torch_load_unsafe
    except Exception as _e:
        print(f"[YOLO][WARN] cannot patch torch.load: {_e}")
    yolo_model = YOLO(YOLO_MODEL_PATH)
    try:
        inner = getattr(yolo_model, "model", None)
        if inner is not None and hasattr(inner, "eval"):
            inner.eval()
    except Exception as _e:
        print(f"[YOLO][WARN] cannot set eval(): {_e}")
    print(
        f"[YOLO] Loaded model from {YOLO_MODEL_PATH} "
        f"(max_width={YOLO_MAX_WIDTH}, imgsz={YOLO_IMGSZ})"
    )
else:
    print(f"[YOLO] DISABLED — detector={PLATE_DETECTOR}, ocr_enabled={OCR_ENABLED}")

print(
    f"[AI] detector={PLATE_DETECTOR} scheduler={OCR_SCHEDULER_MODE} "
    f"snapshot_valid_only={SNAPSHOT_ON_VALID_PLATE_ONLY} "
    f"bg_workers={BACKGROUND_WORKER_COUNT} bg_queue={BACKGROUND_QUEUE_SIZE} "
    f"mem_soft_limit_mb={AI_MEMORY_SOFT_LIMIT_MB}"
)

pattern = re.compile(r"^\d{2}[A-Z]-?\d{4,5}$")
# YOLO + EasyOCR đã đủ chính xác để nhận biển số trong 1 frame.
# Đếm 3 lần (cũ) khiến tốc độ phát hiện rất chậm: mỗi lần OCR mất ~500ms
# + interval 2s => cần 6s mới xác nhận được 1 biển số. Đặt =1 để phát hiện
# ngay lập tức. Anti-spam vẫn dùng cooldown `plate_cooldown_sec`.
required_count = int(os.getenv("PLATE_CONFIRM_COUNT", "1"))
timeout = 2

# ==== BIẾN TOÀN CỤC ====
last_plate_in, last_plate_out = "", ""
plate_counter_in, plate_counter_out = {}, {}
last_seen_time_in, last_seen_time_out = time.time(), time.time()

# Latest frames (luôn được cập nhật trong camera_loop) — dùng cho live preview
# và cho việc chụp snapshot khi có RFID/DATA.
last_frame_in = None
last_frame_out = None
last_preview_write_in = 0.0
last_preview_write_out = 0.0
last_detected_plate_in = ""
last_detected_plate_out = ""

# Thông tin xe vừa detect OCR (direction IN) — đã check subscriber trong DB.
# Dùng khi staff quét thẻ trắng để tạo card đúng loại mà không cần gọi API lại.
# lookupDone: True khi background lookup đã hoàn tất (tránh staff quét trước khi có kết quả).
# detectedAt: thời điểm OCR detect, dùng timeout để tránh dùng dữ liệu cũ.
_PENDING_TIMEOUT = 12  # giây — tránh dính cache biển xe trước khi 2 xe vào sát nhau
pending_vehicle_info = {
    "plate": "",
    "lookupDone": False,
    "isSubscriber": False,
    "ownerName": "Guest",
    "vehicle": None,
    "detectedAt": 0.0,
}

# Path tương đối của snapshot gần nhất do OCR chụp (sau khi YOLO detect
# bbox biển số). Dùng cho việc gắn ảnh vào session/log khi xe vào/ra.
# "" nếu chưa có snapshot cho hướng đó.
last_snapshot_in = ""
last_snapshot_out = ""

# Bbox biển số mới nhất do YOLO detect (để vẽ overlay lên live stream).
# Format: list of (x1, y1, x2, y2, label_text). label_text="" nếu OCR chưa xong.
# Cập nhật bởi _ocr_worker, đọc bởi MJPEG generator.
last_boxes_in: list = []
last_boxes_out: list = []

# Event-based wake-up cho MJPEG generator: mỗi camera có 1 threading.Event
# được set khi camera_loop publish frame mới (last_frame đổi id). Generator
# chờ event thay vì time.sleep cố định → tránh gửi đi gửi lại cùng JPEG
# khi OCR chiếm CPU, là nguyên nhân chính gây cảm giác "giật".
_stream_events: dict[str, threading.Event] = {
    "in": threading.Event(),
    "out": threading.Event(),
}

# Cached host URL cho background thread (cập nhật mỗi request)
_last_bridge_host = ""

scan_enabled_by_direction = {"in": False, "out": False}
scan_start_time_by_direction = {"in": 0.0, "out": 0.0}
scan_timeout_by_direction = {"in": None, "out": None}
last_scanned_uid_by_direction = {"in": None, "out": None}
scan_result_by_direction = {"in": None, "out": None}
scan_message_by_direction = {"in": "", "out": ""}
scan_mode_by_direction = {"in": "gate", "out": "gate"}


# ==== RFID SCAN POLLING STATE (cho Flask UI) ====
def _normalize_scan_direction(direction: str) -> str:
    return direction if direction in ("in", "out") else "in"


def _serial_for_direction(direction: str):
    return (arduino_in, serial_lock_in) if direction == "in" else (arduino_out, serial_lock_out)


def _stop_rfid_scan(direction: str):
    direction = _normalize_scan_direction(direction)
    scan_enabled_by_direction[direction] = False
    ser, lock = _serial_for_direction(direction)
    safe_write(ser, lock, "SCAN_OFF")


def poll_rfid_scan_state(direction="in"):
    direction = _normalize_scan_direction(direction)
    return {
        "scanEnabled": scan_enabled_by_direction[direction],
        "scanResult": scan_result_by_direction[direction],
        "scanMessage": scan_message_by_direction[direction],
        "lastScannedUid": last_scanned_uid_by_direction[direction],
        "scanStartTime": scan_start_time_by_direction[direction],
        "direction": direction,
    }


def set_rfid_scan_enabled(value: bool, direction: str = "in", mode: str = "gate"):
    direction = _normalize_scan_direction(direction)
    scan_mode_by_direction[direction] = mode if mode in ("gate", "inventory") else "gate"
    scan_enabled_by_direction[direction] = value
    scan_start_time_by_direction[direction] = time.time() if value else 0
    scan_result_by_direction[direction] = None
    last_scanned_uid_by_direction[direction] = None
    scan_message_by_direction[direction] = ""
    ser, lock = _serial_for_direction(direction)
    safe_write(ser, lock, "SCAN_ON" if value else "SCAN_OFF")


# ==== OCR & XỬ LÝ FRAME ====
def _save_plate_snapshot(crop_img, full_frame, direction: str, plate_hint: str = "") -> str:
    """
    Khi YOLO vừa detect được bbox biển số -> chụp lại:
      1. Ảnh crop biển số (chỉ phần bbox, có padding) — dùng để OCR.
      2. Ảnh full frame (đã vẽ bbox YOLO + label OCR) — dùng làm bằng chứng.

    Lưu cả 2 vào SNAPSHOT_DIR, tên file chứa direction + timestamp + plate
    để debug. Trả về RELATIVE path của ảnh crop (ảnh dùng để OCR). Nếu lỗi
    I/O trả về "" — caller vẫn tiếp tục OCR trên crop trong RAM.
    """
    try:
        os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    except Exception:
        return ""

    direction_norm = (direction or "in").lower().strip()
    if direction_norm not in ("in", "out"):
        direction_norm = "in"

    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
    plate_norm = _normalize_plate(plate_hint) or "nopl"
    base_name = f"{direction_norm}_{ts}_{plate_norm}"

    crop_path = os.path.join(SNAPSHOT_DIR, f"{base_name}_crop.jpg")
    full_path = os.path.join(SNAPSHOT_DIR, f"{base_name}_full.jpg")

    saved_any = False
    if crop_img is not None and crop_img.size > 0 and _safe_imwrite(crop_path, crop_img):
        saved_any = True
    if full_frame is not None and _safe_imwrite(full_path, full_frame):
        saved_any = True

    if not saved_any:
        return ""
    # Trả về path tương đối để frontend dùng qua Flask static handler
    return f"/static/snapshots/{base_name}_crop.jpg"


def _find_plate_boxes_opencv(frame) -> list:
    """Tìm ứng viên bbox biển số bằng OpenCV (contour + aspect ratio).

    Trả list (x1,y1,x2,y2,score) trên toạ độ ảnh gốc, score ~0.4-0.9 heuristic.
    Không dùng neural net — nhẹ RAM/CPU hơn YOLO rất nhiều.
    """
    if frame is None or frame.size == 0:
        return []
    h0, w0 = frame.shape[:2]
    work = frame
    scale = 1.0
    if OCR_MAX_WIDTH > 0 and w0 > OCR_MAX_WIDTH:
        scale = OCR_MAX_WIDTH / float(w0)
        work = cv2.resize(
            frame,
            (OCR_MAX_WIDTH, max(1, int(h0 * scale))),
            interpolation=cv2.INTER_AREA,
        )
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)
    edges = cv2.Canny(gray, 60, 180)
    edges = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    wh, ww = work.shape[:2]
    min_area = max(80.0, OPENCV_PLATE_MIN_AREA_RATIO * ww * wh)
    max_area = OPENCV_PLATE_MAX_AREA_RATIO * ww * wh
    cands = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        if h <= 0 or w <= 0:
            continue
        aspect = w / float(h)
        # Biển 1 dòng ~3-5; biển 2 dòng VN có thể ~1.5-2.5
        if aspect < OPENCV_PLATE_MIN_ASPECT or aspect > OPENCV_PLATE_MAX_ASPECT:
            continue
        # Ưu tiên hình chữ nhật "đầy" contour
        rect_area = float(w * h)
        fill = area / rect_area if rect_area > 0 else 0.0
        if fill < 0.25:
            continue
        # Score heuristic: aspect gần 4.0 + fill cao
        aspect_score = 1.0 - min(1.0, abs(aspect - 3.8) / 3.0)
        score = 0.35 + 0.35 * fill + 0.30 * max(0.0, aspect_score)
        cands.append((x, y, x + w, y + h, float(min(0.95, score))))

    if not cands:
        return []

    # Non-max soft: giữ box lớn/score cao, bỏ box lồng nhau mạnh
    cands.sort(key=lambda b: (b[4], (b[2] - b[0]) * (b[3] - b[1])), reverse=True)
    kept = []
    for box in cands:
        x1, y1, x2, y2, sc = box
        drop = False
        for kx1, ky1, kx2, ky2, _ in kept:
            ix1, iy1 = max(x1, kx1), max(y1, ky1)
            ix2, iy2 = min(x2, kx2), min(y2, ky2)
            iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
            inter = iw * ih
            a1 = max(1, (x2 - x1) * (y2 - y1))
            a2 = max(1, (kx2 - kx1) * (ky2 - ky1))
            if inter / float(min(a1, a2)) > 0.55:
                drop = True
                break
        if not drop:
            kept.append(box)
        if len(kept) >= OPENCV_PLATE_MAX_CANDIDATES:
            break

    # Scale về ảnh gốc
    if abs(scale - 1.0) < 1e-9:
        return kept
    return _scale_boxes_to_original(kept, scale)


def _ocr_parts_from_crop(crop, min_prob: float = 0.3) -> list[str]:
    """Chạy PaddleOCR trên crop, trả list text đã clean."""
    if crop is None or getattr(crop, "size", 0) == 0 or paddle_ocr is None:
        return []
    try:
        ocr_raw = paddle_ocr.ocr(crop, cls=False)
    except Exception as e:
        print(f"[OCR][ERROR] {type(e).__name__}: {e}")
        if "not enough memory" in str(e).lower() or "out of memory" in str(e).lower():
            _set_memory_degraded("oom")
        return []
    if not ocr_raw or ocr_raw[0] is None:
        return []
    parts = []
    for item in ocr_raw[0]:
        try:
            _, (text, prob) = item
        except Exception:
            continue
        text_clean = re.sub(r"[^A-Z0-9]", "", (text or "").upper())
        if len(text_clean) >= 2 and float(prob) > min_prob:
            parts.append(text_clean)
    return parts


def _join_plate_parts(parts: list[str]) -> str | None:
    if not parts:
        return None
    if len(parts) == 1:
        return parts[0]
    return parts[0] + "".join(parts[1:])


# ==== ROI (Region of Interest) ====
# ROI theo hướng "in"/"out" (tọa độ hệ 640x360 của editor). None = xử lý toàn frame.
ROI_STATE = {"in": None, "out": None}
ROI_LAST_FETCH = 0.0
ROI_REFRESH_SEC = 30.0
ROI_EDITOR_W = 640
ROI_EDITOR_H = 360


def _refresh_rois():
    """Làm mới ROI từ backend mỗi ROI_REFRESH_SEC giây (gọi trong process_frame)."""
    global ROI_LAST_FETCH
    now = time.time()
    if now - ROI_LAST_FETCH < ROI_REFRESH_SEC:
        return
    ROI_LAST_FETCH = now
    if backend is None:
        return
    rois = backend.fetch_rois()
    if isinstance(rois, dict):
        ROI_STATE["in"] = rois.get("entry") or None
        ROI_STATE["out"] = rois.get("exit") or None
        print("[ROI] updated:", {k: v for k, v in ROI_STATE.items() if v})


def _apply_roi(frame, direction):
    """Trả (work, roi_x, roi_y) — work là vùng crop theo ROI hoặc nguyên frame.

    Tọa độ ROI từ editor là hệ 640x360; scale theo kích thước frame thật.
    Vùng crop quá nhỏ (<40x20) bị coi như không có ROI.
    """
    roi = ROI_STATE.get(direction)
    if not roi:
        return frame, 0, 0
    h_f, w_f = frame.shape[:2]
    try:
        rx = int(roi.get("x", 0) * w_f / ROI_EDITOR_W)
        ry = int(roi.get("y", 0) * h_f / ROI_EDITOR_H)
        rw = int(roi.get("width", 0) * w_f / ROI_EDITOR_W)
        rh = int(roi.get("height", 0) * h_f / ROI_EDITOR_H)
    except (TypeError, AttributeError):
        return frame, 0, 0
    rx = max(0, min(rx, w_f - 20))
    ry = max(0, min(ry, h_f - 15))
    rw = min(rw, w_f - rx)
    rh = min(rh, h_f - ry)
    if rw < 40 or rh < 20:
        return frame, 0, 0
    return frame[ry:ry + rh, rx:rx + rw], rx, ry


def process_frame(frame, plate_counter, last_plate, last_seen_time, prefix, ser, lock=None, direction="in"):
    global last_boxes_in, last_boxes_out, _ai_metrics
    # OCR tắt -> trả frame nguyên bản, không tốn CPU.
    if not OCR_ENABLED or paddle_ocr is None:
        return frame, plate_counter, last_plate, last_seen_time, "", ""

    detected_snap = ""
    pending_crop = None
    is_in = (direction == "in")
    t0 = time.time()
    candidate = None
    detector = PLATE_DETECTOR if yolo_model is not None or PLATE_DETECTOR != "yolo" else "opencv"
    if PLATE_DETECTOR == "yolo" and yolo_model is None:
        detector = "opencv"

    # ROI: chỉ detect trong vùng admin vẽ; ngoài vùng bị bỏ qua hoàn toàn.
    _refresh_rois()
    work, roi_x, roi_y = _apply_roi(frame, direction)
    has_roi = work is not frame
    if has_roi:
        h_roi, w_roi = work.shape[:2]
        cv2.rectangle(frame, (roi_x, roi_y), (roi_x + w_roi, roi_y + h_roi), (0, 255, 136), 2)

    # Mọi YOLO/PaddleOCR đi qua 1 lock — chặn peak RAM khi 2 cam cùng inference.
    with _inference_lock:
        boxes = []
        # ---- BƯỚC 1: tìm bbox ứng viên ----
        if detector == "yolo" and yolo_model is not None:
            yolo_frame, yolo_scale = _resize_for_yolo(work, YOLO_MAX_WIDTH)
            predict_kwargs = {
                "conf": YOLO_CONF_THR,
                "verbose": False,
                "imgsz": YOLO_IMGSZ,
            }
            try:
                if torch is not None:
                    with torch.inference_mode():
                        results = yolo_model(yolo_frame, **predict_kwargs)
                else:
                    results = yolo_model(yolo_frame, **predict_kwargs)
            except Exception as e:
                print(f"[YOLO][ERROR] {direction}: {type(e).__name__}: {e}")
                if "not enough memory" in str(e).lower() or "out of memory" in str(e).lower():
                    _set_memory_degraded("oom")
                return frame, plate_counter, last_plate, last_seen_time, "", ""

            if results and len(results) > 0:
                for r in results:
                    if r.boxes is not None and len(r.boxes) > 0:
                        for box in r.boxes:
                            x1, y1, x2, y2 = box.xyxy[0].tolist()
                            conf = float(box.conf[0])
                            boxes.append((int(x1), int(y1), int(x2), int(y2), conf))
            try:
                del results
            except Exception:
                pass
            if yolo_frame is not frame:
                try:
                    del yolo_frame
                except Exception:
                    pass
            boxes = _scale_boxes_to_original(boxes, yolo_scale)
            boxes = _dedupe_plate_boxes(boxes)
            if has_roi and boxes:
                # Boxes đang là tọa độ trong vùng ROI → dịch về tọa độ frame gốc
                # để overlay/snapshot downstream khớp ảnh hiển thị.
                boxes = [
                    (x1 + roi_x, y1 + roi_y, x2 + roi_x, y2 + roi_y, conf)
                    for (x1, y1, x2, y2, conf) in boxes
                ]
            if boxes:
                max_conf = max(b[4] for b in boxes)
                if max_conf < 0.5:
                    print(f"[YOLO][{direction}] confs={[b[4] for b in boxes]} (max={max_conf:.2f})")

        elif detector == "opencv":
            boxes = _find_plate_boxes_opencv(work)
            if has_roi and boxes:
                boxes = [
                    (x1 + roi_x, y1 + roi_y, x2 + roi_x, y2 + roi_y, conf)
                    for (x1, y1, x2, y2, conf) in boxes
                ]

        # fullframe hoặc không có box -> OCR toàn frame (đã resize)
        if detector == "fullframe" or not boxes:
            if detector != "fullframe" and not boxes:
                if is_in:
                    last_boxes_in = []
                else:
                    last_boxes_out = []
            gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
            if OCR_MAX_WIDTH > 0 and gray.shape[1] > OCR_MAX_WIDTH:
                sc = OCR_MAX_WIDTH / gray.shape[1]
                gray = cv2.resize(
                    gray,
                    (OCR_MAX_WIDTH, max(1, int(gray.shape[0] * sc))),
                    interpolation=cv2.INTER_AREA,
                )
            parts_all = _ocr_parts_from_crop(gray, min_prob=0.5)
            candidate = _join_plate_parts(parts_all)
        else:
            tag = "YOLO" if detector == "yolo" else "CV"
            for (x1, y1, x2, y2, conf) in boxes:
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                cv2.putText(
                    frame, f"{tag} {conf:.2f}", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2,
                )
            overlay_boxes = [
                (x1, y1, x2, y2, conf, "") for (x1, y1, x2, y2, conf) in boxes
            ]
            if is_in:
                last_boxes_in = overlay_boxes
            else:
                last_boxes_out = overlay_boxes

            # OCR lần lượt các crop; dừng khi ra plate hợp lệ
            h_img, w_img = frame.shape[:2]
            pad = 10
            best_parts = []
            best_box = boxes[0]
            for (x1, y1, x2, y2, conf) in boxes:
                cx1 = max(0, x1 - pad)
                cy1 = max(0, y1 - pad)
                cx2 = min(w_img, x2 + pad)
                cy2 = min(h_img, y2 + pad)
                crop = frame[cy1:cy2, cx1:cx2]
                if crop.size == 0:
                    continue
                parts = _ocr_parts_from_crop(crop, min_prob=0.3)
                joined = _join_plate_parts(parts)
                if joined and pattern.match(joined):
                    best_parts = parts
                    best_box = (x1, y1, x2, y2, conf)
                    pending_crop = crop
                    candidate = joined
                    break
                if parts and (not best_parts or len(joined or "") > len(_join_plate_parts(best_parts) or "")):
                    best_parts = parts
                    best_box = (x1, y1, x2, y2, conf)
                    pending_crop = crop
                    candidate = joined

            if pending_crop is None and best_box is not None:
                x1, y1, x2, y2, _ = best_box
                cx1 = max(0, x1 - pad)
                cy1 = max(0, y1 - pad)
                cx2 = min(w_img, x2 + pad)
                cy2 = min(h_img, y2 + pad)
                pending_crop = frame[cy1:cy2, cx1:cx2]

            if pending_crop is not None and pending_crop.size > 0:
                if not SNAPSHOT_ON_VALID_PLATE_ONLY:
                    detected_snap = _save_plate_snapshot(
                        pending_crop, frame, direction, plate_hint=""
                    )

            if candidate:
                updated = [
                    (bx1, by1, bx2, by2, bconf, candidate)
                    for (bx1, by1, bx2, by2, bconf, _) in overlay_boxes
                ]
                if is_in:
                    last_boxes_in = updated
                else:
                    last_boxes_out = updated

    _ai_metrics["inferences"] = int(_ai_metrics.get("inferences", 0)) + 1
    _ai_metrics["last_inference_ms"] = (time.time() - t0) * 1000.0

    # ---- Xác nhận biển số với cooldown ----
    if candidate and pattern.match(candidate):
        plate_counter[candidate] = plate_counter.get(candidate, 0) + 1
        if (
            plate_counter[candidate] >= required_count
            and candidate != last_plate
            and (time.time() - last_seen_time) > PLATE_COOLDOWN_SEC
        ):
            print(f"{prefix} Biển số:", candidate, f"(detector={detector})")
            last_plate = candidate
            last_seen_time = time.time()
            plate_counter.clear()

            if not detected_snap:
                detected_snap = _save_plate_snapshot(
                    pending_crop, frame, direction, plate_hint=candidate
                )

            try:
                line = prefix + candidate
                if ser is not None:
                    if lock is None:
                        ser.write((line + "\n").encode())
                    else:
                        safe_write(ser, lock, line)
                    print("Sent to Arduino:", line)
            except Exception as e:
                print(f"[OCR][ERROR] serial write failed: {type(e).__name__}: {e}")

    if time.time() - last_seen_time > timeout:
        last_plate = ""

    detected = candidate if (candidate and pattern.match(candidate)) else ""
    return frame, plate_counter, last_plate, last_seen_time, detected, detected_snap


# ==== ĐỌC TỪ ARDUINO ====
def read_from_arduino(ser, ser_out=None, direction="in"):
    global pending_vehicle_info
    direction = _normalize_scan_direction(direction)

    if ser is None or ser.in_waiting <= 0:
        return

    line = ser.readline().decode(errors="ignore").strip()
    if not line:
        return

    if line.startswith("UID:"):
        print(f"[SCAN][{direction.upper()}][UID RAW]", line)

    if scan_enabled_by_direction[direction] and line.startswith("UID:"):
        uid = line.replace("UID:", "").strip()
        if not uid:
            return

        scan_result_by_direction[direction] = "success"
        scan_message_by_direction[direction] = ""
        last_scanned_uid_by_direction[direction] = uid

        if scan_mode_by_direction[direction] == "inventory":
            scan_message_by_direction[direction] = "Đã đọc UID thẻ, sẵn sàng nhập kho."
            _stop_rfid_scan(direction)
            return

        if direction == "out":
            _stop_rfid_scan(direction)
            return

        if not pending_vehicle_info.get("lookupDone"):
            waited = 0.0
            while waited < 5.0 and not pending_vehicle_info.get("lookupDone"):
                time.sleep(0.2)
                waited += 0.2
            if not pending_vehicle_info.get("lookupDone"):
                scan_result_by_direction[direction] = "error"
                scan_message_by_direction[direction] = "Đang xác minh biển số, vui lòng thử lại."
                _stop_rfid_scan(direction)
                return

        if pending_vehicle_info.get("lookupError"):
            scan_result_by_direction[direction] = "error"
            scan_message_by_direction[direction] = "Không thể xác minh thông tin xe, vui lòng thử lại."
            pending_vehicle_info = {"plate": "", "lookupDone": False, "lookupError": False, "isSubscriber": False, "ownerName": "Guest", "vehicle": None, "detectedAt": 0.0}
            _stop_rfid_scan(direction)
            return

        elapsed = time.time() - (pending_vehicle_info.get("detectedAt") or 0)
        if elapsed > _PENDING_TIMEOUT:
            scan_result_by_direction[direction] = "error"
            scan_message_by_direction[direction] = "Dữ liệu biển số đã hết hạn. Xe vui lòng lùi lại để camera nhận lại."
            pending_vehicle_info = {"plate": "", "lookupDone": False, "lookupError": False, "isSubscriber": False, "ownerName": "Guest", "vehicle": None, "detectedAt": 0.0}
            _stop_rfid_scan(direction)
            return

        pending_plate = _normalize_plate(pending_vehicle_info.get("plate") or "")
        current_plate = pending_plate or _normalize_plate(last_detected_plate_in or "")
        if pending_plate and pending_plate != _normalize_plate(last_detected_plate_in or ""):
            scan_result_by_direction[direction] = "error"
            scan_message_by_direction[direction] = "Biển số đã thay đổi, vui lòng chờ camera nhận lại."
            pending_vehicle_info = {"plate": "", "lookupDone": False, "lookupError": False, "isSubscriber": False, "ownerName": "Guest", "vehicle": None, "detectedAt": 0.0}
            _stop_rfid_scan(direction)
            return

        is_subscriber = pending_vehicle_info.get("isSubscriber", False)
        owner_name = pending_vehicle_info.get("ownerName") or "Guest"
        card_user_type = "resident" if is_subscriber else "guest"
        result = backend.rfid_scan_register(uid, owner_name=owner_name, plate=current_plate, user_type=card_user_type)
        scanned_card = result.get("card") or {}
        scanned_card_type = str(scanned_card.get("cardType") or "guest").lower()
        if is_subscriber and scanned_card_type != "member":
            scan_result_by_direction[direction] = "error"
            scan_message_by_direction[direction] = "Xe thành viên phải dùng đúng RFID Member đã liên kết với biển số này."
        elif not result.get("ok"):
            scan_result_by_direction[direction] = "error"
            scan_message_by_direction[direction] = (
                result.get("message")
                or ("Thẻ Member không khớp với biển số xe camera phát hiện. Vui lòng dùng đúng RFID Member liên kết."
                    if is_subscriber
                    else "Thẻ Guest không hợp lệ hoặc chưa sẵn sàng. Vui lòng thử lại.")
            )
        else:
            sync_cmd = f"ADD|{uid}|{owner_name}|{current_plate}|{card_user_type}|active"
            safe_write(arduino_in, serial_lock_in, sync_cmd)
            if current_plate:
                image_path = capture_snapshot_for_event("in", base_url=_last_bridge_host)
                push_result = backend.push_camera_log(direction="in", detected_plate=current_plate, confidence=0.95, rfid_uid=uid, owner_name=owner_name, plate=current_plate, user_type=card_user_type, image_path=image_path, metadata={"source": "staff-scan", "snapshot": bool(image_path), "isSubscriber": is_subscriber})
                if push_result.get("ok"):
                    open_gate("in")
                    def _auto_close_in():
                        time.sleep(5)
                        close_gate("in")
                    # Thread riêng: sleep dài không được chiếm background pool
                    threading.Thread(target=_auto_close_in, daemon=True).start()
                    user_label = "Resident" if is_subscriber else "Guest"
                    scan_message_by_direction[direction] = f"{user_label}: {current_plate} — barrier opened"
                else:
                    scan_result_by_direction[direction] = "error"
                    push_data = push_result.get("data") or {}
                    scan_message_by_direction[direction] = (
                        push_result.get("message")
                        or push_data.get("message")
                        or "Không thể tạo phiên cho thẻ Guest. Vui lòng thử lại."
                    )
            else:
                scan_message_by_direction[direction] = "Chưa detect được biển số. Vui lòng chờ camera nhận biển."

        pending_vehicle_info = {"plate": "", "lookupDone": False, "lookupError": False, "isSubscriber": False, "ownerName": "Guest", "vehicle": None, "detectedAt": 0.0}
        _stop_rfid_scan(direction)
        return

    # DATA log từ ESP32
    if line.startswith("DATA"):
        print("[LOG]", line)
        try:
            parts = line.split(",")
            uid = parts[3] if len(parts) > 3 else ""
            name = parts[4] if len(parts) > 4 else ""
            plate = parts[5] if len(parts) > 5 else ""
            data_direction = parts[6] if len(parts) > 6 else ""

            norm_plate = _normalize_plate(plate)

            rfid_card = backend.rfid_lookup_uid(uid) if uid else None
            user_type = (rfid_card or {}).get("userType", "guest")

            # Xác định direction để chụp snapshot (lưu kèm session)
            push_direction = data_direction.lower() if data_direction.lower() in ["in", "out"] else direction
            image_path = capture_snapshot_for_event(push_direction, base_url=_last_bridge_host)

            backend.push_camera_log(
                direction=push_direction,
                detected_plate=norm_plate or "",
                confidence=0.95,
                rfid_uid=uid,
                owner_name=name,
                plate=norm_plate,
                user_type=user_type,
                image_path=image_path,
                metadata={"source": "esp32-data", "snapshot": bool(image_path)},
            )

            # Đồng bộ ngược: nếu là Guest vào thì cập nhật plate
            if name == "Guest" and data_direction == "In" and norm_plate and uid:
                backend.rfid_scan_register(
                    uid=uid,
                    owner_name="Guest",
                    plate=norm_plate,
                    user_type="guest",
                )
                reg_cmd = f"REG:{uid},{norm_plate}"
                safe_write(ser_out or arduino_out, serial_lock_out, reg_cmd)

            # Nếu Guest ra thì xóa thẻ
            if name == "Guest" and data_direction == "Out" and uid:
                try:
                    requests.delete(
                        f"{backend.base_url}/api/rfid/{uid}",
                        headers={"X-Service-Token": backend.session.headers["X-Service-Token"]},
                        timeout=5,
                    )
                except Exception as e:
                    print("[BACKEND][RFID_DELETE] error:", e)
                del_cmd = f"DEL:{uid}"
                safe_write(arduino_in, serial_lock_in, del_cmd)

            # Xe ra: mở barie, sau 5 giây tự đóng
            if data_direction == "Out":
                open_gate("out")
                def _auto_close_out():
                    time.sleep(7)
                    close_gate("out")
                threading.Thread(target=_auto_close_out, daemon=True).start()

        except Exception as e:
            print("[ERROR] Parse log failed:", e)


# ==== BARRIER ====
def open_gate(gate='in'):
    ser = arduino_in if gate == 'in' else arduino_out
    if gate == 'in':
        safe_write(ser, serial_lock_in, 'OPEN_GATE')
    else:
        safe_write(ser, serial_lock_out, 'OPEN_GATE')
    backend.gate_control(gate, "open")
    print(f"[MANUAL] Sent OPEN_GATE to Arduino {gate.upper()}")


def close_gate(gate='in'):
    ser = arduino_in if gate == 'in' else arduino_out
    if gate == 'in':
        safe_write(ser, serial_lock_in, 'CLOSE_GATE')
    else:
        safe_write(ser, serial_lock_out, 'CLOSE_GATE')
    backend.gate_control(gate, "close")
    print(f"[MANUAL] Sent CLOSE_GATE to Arduino {gate.upper()}")


# ==== CAMERA LOOP / OCR SCHEDULER ====
def _handle_ocr_side_effects(direction_key, last_plate, detected, detected_snap):
    """Cập nhật state + push/lookup nền sau khi process_frame xong."""
    global last_detected_plate_in, last_detected_plate_out
    global last_snapshot_in, last_snapshot_out
    global pending_vehicle_info

    if detected:
        if direction_key == "in":
            last_detected_plate_in = detected
        else:
            last_detected_plate_out = detected
    if detected_snap:
        if direction_key == "in":
            last_snapshot_in = detected_snap
        else:
            last_snapshot_out = detected_snap

    # detected != "" và khác last_plate → plate vừa được accept
    if not (detected and detected != last_plate):
        return

    snap_path = detected_snap or ""
    conf_val = 0.0
    boxes = last_boxes_in if direction_key == "in" else last_boxes_out
    if boxes:
        conf_val = float(boxes[0][4]) if len(boxes[0]) > 4 else 0.0

    def _push_ocr_log(plate=detected, direction=direction_key,
                      snap=snap_path, conf=conf_val):
        try:
            backend.push_camera_log(
                direction=direction,
                detected_plate=plate,
                confidence=conf,
                plate=plate,
                user_type="guest",
                image_path=snap,
                metadata={"source": "camera-ocr"},
            )
            print(f"[OCR][PUSH] direction={direction} plate={plate} conf={conf:.2f}")
        except Exception as push_err:
            print(f"[OCR][PUSH][ERROR] {push_err}")

    _submit_background(_push_ocr_log)

    if direction_key == "in":
        def _lookup_vehicle_info(plate=detected, direction=direction_key,
                                 snap=snap_path, conf=conf_val):
            global pending_vehicle_info
            try:
                info = backend.rfid_lookup_plate(plate)
                is_sub = info.get("isResident", info.get("isSubscriber", False))
                vehicle = info.get("vehicle") or {}
                owner = vehicle.get("ownerName") or "Guest"
                pending_vehicle_info = {
                    "plate": plate,
                    "lookupDone": True,
                    "isSubscriber": is_sub,
                    "ownerName": owner,
                    "vehicle": vehicle,
                    "detectedAt": time.time(),
                }
                label = "Resident" if is_sub else "Guest"
                print(f"[OCR][LOOKUP] {plate} → {label} (owner={owner})")
                if is_sub:
                    backend.push_camera_log(
                        direction=direction,
                        detected_plate=plate,
                        confidence=conf,
                        plate=plate,
                        user_type="resident",
                        image_path=snap,
                        metadata={"source": "camera-ocr", "lookupResult": "registered-or-subscriber"},
                    )
                    print(f"[OCR][PUSH-UPDATE] {plate} → resident")
            except Exception as e:
                print(f"[OCR][LOOKUP][ERROR] {e}")
                pending_vehicle_info = {
                    "plate": plate,
                    "lookupDone": True,
                    "lookupError": True,
                    "isSubscriber": False,
                    "ownerName": "Guest",
                    "vehicle": None,
                    "detectedAt": time.time(),
                }

        pending_vehicle_info = {
            "plate": detected,
            "lookupDone": False,
            "lookupError": False,
            "isSubscriber": False,
            "ownerName": "Guest",
            "vehicle": None,
            "detectedAt": time.time(),
        }
        _submit_background(_lookup_vehicle_info)


def _ocr_worker(frame_copy, plate_counter, last_plate, last_seen_time,
                prefix, ser, lock, direction_key):
    """Chạy OCR (YOLO+PaddleOCR) trên bản copy frame — KHÔNG block camera stream.

    Dùng bởi legacy mode. Single-worker mode dùng OcrScheduler.
    """
    global _ai_metrics
    _ai_metrics["ocr_busy"] = True
    try:
        _, pc, lp, lst, detected, detected_snap = process_frame(
            frame_copy, plate_counter, last_plate, last_seen_time,
            prefix, ser, lock, direction_key,
        )
        _ocr_worker.results[direction_key] = (pc, lp, lst, detected, detected_snap)
        _handle_ocr_side_effects(direction_key, last_plate, detected, detected_snap)
    except Exception as e:
        print(f"[OCR][WORKER][ERROR] {direction_key}: {type(e).__name__}: {e}")
        if "not enough memory" in str(e).lower() or "out of memory" in str(e).lower():
            _set_memory_degraded("oom")
        _ocr_worker.results[direction_key] = (
            plate_counter, last_plate, last_seen_time, "", ""
        )
    finally:
        _ai_metrics["ocr_busy"] = False


_ocr_worker.results = {}


class OcrScheduler:
    """1 AI worker + latest-frame slot mỗi hướng (ghi đè frame cũ khi bận)."""

    def __init__(self):
        self._cond = threading.Condition()
        self._pending = {}  # direction -> frame (numpy)
        self._state = {
            "in": {"plate_counter": {}, "last_plate": "", "last_seen_time": time.time()},
            "out": {"plate_counter": {}, "last_plate": "", "last_seen_time": time.time()},
        }
        self._running = True
        self._thread = threading.Thread(
            target=self._worker_loop, name="ocr-scheduler", daemon=True
        )
        self._thread.start()
        print("[OCR] OcrScheduler started (single-worker, 1-slot/direction)")

    def submit(self, direction: str, frame) -> None:
        global _ai_metrics
        if not self._running or frame is None:
            return
        if _check_memory_pressure():
            _ai_metrics["frames_dropped"] = int(_ai_metrics.get("frames_dropped", 0)) + 1
            return
        with self._cond:
            if direction in self._pending:
                _ai_metrics["frames_dropped"] = int(_ai_metrics.get("frames_dropped", 0)) + 1
            # Giữ bản copy — caller có thể reuse buffer camera
            self._pending[direction] = frame.copy()
            self._cond.notify()

    def stop(self) -> None:
        self._running = False
        with self._cond:
            self._cond.notify_all()

    def _pop_next(self):
        """Ưu tiên hướng có frame pending; round-robin nhẹ theo timestamp submit."""
        # Deterministic: ưu tiên "in" rồi "out" — đủ cho bãi xe
        if "in" in self._pending:
            return "in", self._pending.pop("in")
        if "out" in self._pending:
            return "out", self._pending.pop("out")
        return None, None

    def _worker_loop(self):
        global plate_counter_in, last_plate_in, last_seen_time_in
        global plate_counter_out, last_plate_out, last_seen_time_out
        global last_snapshot_in, last_snapshot_out
        global _ai_metrics

        while self._running:
            with self._cond:
                while self._running and not self._pending:
                    self._cond.wait(timeout=0.5)
                if not self._running:
                    break
                direction, frame = self._pop_next()

            if direction is None or frame is None:
                continue

            st = self._state[direction]
            # Đồng bộ state từ global (camera_loop / RFID có thể đổi last_plate)
            if direction == "in":
                st["plate_counter"] = dict(plate_counter_in)
                st["last_plate"] = last_plate_in
                st["last_seen_time"] = last_seen_time_in
                prefix, ser, lock = "IN:", arduino_in, serial_lock_in
            else:
                st["plate_counter"] = dict(plate_counter_out)
                st["last_plate"] = last_plate_out
                st["last_seen_time"] = last_seen_time_out
                prefix, ser, lock = "OUT:", arduino_out, serial_lock_out

            prev_last_plate = st["last_plate"]
            _ai_metrics["ocr_busy"] = True
            try:
                _, pc, lp, lst, detected, detected_snap = process_frame(
                    frame,
                    st["plate_counter"],
                    st["last_plate"],
                    st["last_seen_time"],
                    prefix,
                    ser,
                    lock,
                    direction,
                )
                st["plate_counter"] = pc
                st["last_plate"] = lp
                st["last_seen_time"] = lst

                if direction == "in":
                    plate_counter_in = pc
                    last_plate_in = lp
                    last_seen_time_in = lst
                    if detected_snap:
                        last_snapshot_in = detected_snap
                else:
                    plate_counter_out = pc
                    last_plate_out = lp
                    last_seen_time_out = lst
                    if detected_snap:
                        last_snapshot_out = detected_snap

                _handle_ocr_side_effects(direction, prev_last_plate, detected, detected_snap)
            except Exception as e:
                print(f"[OCR][SCHED][ERROR] {direction}: {type(e).__name__}: {e}")
                if "not enough memory" in str(e).lower() or "out of memory" in str(e).lower():
                    _set_memory_degraded("oom")
            finally:
                _ai_metrics["ocr_busy"] = False
                try:
                    del frame
                except Exception:
                    pass


_ocr_scheduler = None  # init sau khi model/serial sẵn sàng (trong camera_loop / main)


def camera_loop():
    global plate_counter_in, last_plate_in, last_seen_time_in
    global plate_counter_out, last_plate_out, last_seen_time_out
    global last_frame_in, last_frame_out
    global last_preview_write_in, last_preview_write_out
    global last_detected_plate_in, last_detected_plate_out
    global cap_in, cap_out, _ocr_scheduler

    # Thư mục đã được tạo ở boot. Reset interval để lần đầu tiên ghi ngay.
    last_preview_write_in = 0.0
    last_preview_write_out = 0.0

    # Backoff state cho mỗi camera
    camera_loop.fail_in = 0
    camera_loop.fail_out = 0

    # Lần OCR gần nhất của từng camera
    last_ocr_in = 0.0
    last_ocr_out = 0.0

    use_single = OCR_SCHEDULER_MODE == "single-worker" and OCR_ENABLED
    if use_single:
        if _ocr_scheduler is None:
            _ocr_scheduler = OcrScheduler()
        ocr_thread_in = None
        ocr_thread_out = None
        print("[OCR] camera_loop using single-worker scheduler")
    else:
        # legacy: 1 thread OCR mỗi hướng
        ocr_thread_in = None
        ocr_thread_out = None
        print(f"[OCR] camera_loop using legacy dual-thread mode (mode={OCR_SCHEDULER_MODE})")

    while True:
        # ===== BƯỚC 1: Đọc frame NHANH — không OCR, không chặn stream =====
        ret_in, frame_in = _safe_read(cap_in)
        if ret_in:
            camera_loop.fail_in = 0
        else:
            camera_loop.fail_in += 1
            if cap_in is not None and camera_loop.fail_in >= 30:
                cap_in.release()
                cap_in = _reconnect(_CAM_INDEX_IN_RESOLVED)
                if cap_in is not None:
                    print("[CAM_IN] Reconnected after fail streak")
                camera_loop.fail_in = 0
            elif cap_in is None and camera_loop.fail_in >= 300:
                cap_in = _reconnect(_CAM_INDEX_IN_RESOLVED)
                camera_loop.fail_in = 0

        ret_out, frame_out = _safe_read(cap_out)
        if ret_out:
            camera_loop.fail_out = 0
        else:
            camera_loop.fail_out += 1
            if cap_out is not None and camera_loop.fail_out >= 30:
                cap_out.release()
                cap_out = _reconnect(_CAM_INDEX_OUT_RESOLVED)
                if cap_out is not None:
                    print("[CAM_OUT] Reconnected after fail streak")
                camera_loop.fail_out = 0
            elif cap_out is None and camera_loop.fail_out >= 300:
                cap_out = _reconnect(_CAM_INDEX_OUT_RESOLVED)
                camera_loop.fail_out = 0

        now = time.time()

        # ===== BƯỚC 2: Cập nhật last_frame NGAY sau khi đọc =====
        # Frame sạch (chưa OCR drawings) → stream mượt, không chờ OCR.
        if ret_in:
            last_frame_in = frame_in
            _stream_events["in"].set()  # báo cho MJPEG generator có frame mới
            if now - last_preview_write_in >= LIVE_PREVIEW_INTERVAL_SEC:
                _safe_imwrite(os.path.join(STATIC_DIR, "cam_in.jpg"), frame_in)
                last_preview_write_in = now

        if ret_out:
            last_frame_out = frame_out
            _stream_events["out"].set()  # báo cho MJPEG generator có frame mới
            if now - last_preview_write_out >= LIVE_PREVIEW_INTERVAL_SEC:
                _safe_imwrite(os.path.join(STATIC_DIR, "cam_out.jpg"), frame_out)
                last_preview_write_out = now

        # ===== BƯỚC 3: OCR — single-worker scheduler hoặc legacy dual-thread =====
        if OCR_ENABLED:
            if use_single and _ocr_scheduler is not None:
                if ret_in and now - last_ocr_in >= OCR_INTERVAL_SEC:
                    last_ocr_in = now
                    _ocr_scheduler.submit("in", frame_in)
                if ret_out and now - last_ocr_out >= OCR_INTERVAL_SEC:
                    last_ocr_out = now
                    _ocr_scheduler.submit("out", frame_out)
            else:
                # legacy: 1 thread OCR mỗi hướng (có thể overlap → peak RAM)
                if (ret_in and now - last_ocr_in >= OCR_INTERVAL_SEC
                        and (ocr_thread_in is None or not ocr_thread_in.is_alive())
                        and not _check_memory_pressure()):
                    last_ocr_in = now
                    frame_copy = frame_in.copy()
                    ocr_thread_in = threading.Thread(
                        target=_ocr_worker,
                        args=(frame_copy, dict(plate_counter_in), last_plate_in,
                              last_seen_time_in, "IN:", arduino_in, serial_lock_in, "in"),
                        daemon=True,
                    )
                    ocr_thread_in.start()

                if (ret_out and now - last_ocr_out >= OCR_INTERVAL_SEC
                        and (ocr_thread_out is None or not ocr_thread_out.is_alive())
                        and not _check_memory_pressure()):
                    last_ocr_out = now
                    frame_copy = frame_out.copy()
                    ocr_thread_out = threading.Thread(
                        target=_ocr_worker,
                        args=(frame_copy, dict(plate_counter_out), last_plate_out,
                              last_seen_time_out, "OUT:", arduino_out, serial_lock_out, "out"),
                        daemon=True,
                    )
                    ocr_thread_out.start()

                for key in ("in", "out"):
                    res = _ocr_worker.results.pop(key, None)
                    if res is not None:
                        pc, lp, lst, detected, detected_snap = res
                        if key == "in":
                            plate_counter_in = pc
                            last_plate_in = lp
                            last_seen_time_in = lst
                            if detected_snap:
                                last_snapshot_in = detected_snap
                        else:
                            plate_counter_out = pc
                            last_plate_out = lp
                            last_seen_time_out = lst
                            if detected_snap:
                                last_snapshot_out = detected_snap

        # Đọc serial (RFID / DATA từ ESP32)
        read_from_arduino(arduino_in, ser_out=arduino_out, direction="in")
        read_from_arduino(arduino_out, direction="out")

        # Nếu cả 2 camera fail thì backoff để không đốt CPU.
        if not ret_in and not ret_out:
            streak = max(camera_loop.fail_in, camera_loop.fail_out)
            time.sleep(min(0.05 * (2 ** min(streak, 5)), 1.0))
        else:
            time.sleep(CAMERA_LOOP_SLEEP)


def _safe_imwrite(path: str, frame) -> bool:
    """cv2.imwrite nhưng nuốt lỗi để camera loop không chết vì I/O."""
    try:
        cv2.imwrite(path, frame)
        return True
    except Exception as e:
        print(f"[CAMERA][WARN] imwrite({path}) failed:", e)
        return False


def capture_snapshot_for_event(direction: str, base_url: str = "") -> str:
    """
    Lưu ảnh JPEG cho 1 sự kiện xe vào/ra, trả về URL path để gửi backend.
    KHÔNG spam: chỉ gọi khi có RFID scan thành công / DATA log từ ESP32.

    Ưu tiên dùng snapshot đã chụp bởi OCR (last_snapshot_in/out) — ảnh này
    đã được YOLO detect bbox biển số và đã qua OCR, nên chắc chắn chứa
    biển số hợp lệ. Nếu không có (OCR chưa kịp detect hoặc OCR tắt) ->
    fallback về chụp từ last_frame (giống hành vi cũ).

    direction: "in" | "out"
    base_url: nếu truyền vào, trả về absolute URL để frontend backend hiển thị được.
    """
    global last_snapshot_in, last_snapshot_out, last_detected_plate_in, last_detected_plate_out
    direction_norm = (direction or "").lower().strip()
    if direction_norm not in ("in", "out"):
        direction_norm = "in"

    # ---- ƯU TIÊN 1: dùng snapshot đã chụp bởi OCR ----
    ocr_snap_rel = last_snapshot_in if direction_norm == "in" else last_snapshot_out
    if ocr_snap_rel:
        # ocr_snap_rel dạng "/static/snapshots/xxx_crop.jpg" — copy sang tên
        # mới có chứa UID để gắn với session, tránh bị 2 xe cùng lúc ghi đè.
        ocr_snap_abs = os.path.join(_BASE_DIR, ocr_snap_rel.lstrip("/"))
        if os.path.isfile(ocr_snap_abs):
            try:
                now = datetime.now()
                ts = now.strftime("%Y%m%d_%H%M%S_%f")[:-3]
                uid_part = (last_scanned_uid_by_direction[direction_norm] or "anon").replace(":", "").replace("|", "")[:24]
                plate_part = (last_detected_plate_in if direction_norm == "in" else last_detected_plate_out) or ""
                plate_norm = _normalize_plate(plate_part) or "nopl"
                new_fname = f"{direction_norm}_{ts}_{plate_norm}_{uid_part}.jpg"
                new_fpath = os.path.join(SNAPSHOT_DIR, new_fname)
                os.makedirs(SNAPSHOT_DIR, exist_ok=True)
                # Đọc từ snapshot OCR rồi ghi lại (chuyển tên có UID).
                # Tránh shutil.copy vì cần đảm bảo JPEG re-encode chuẩn.
                src = cv2.imread(ocr_snap_abs)
                if src is not None and _safe_imwrite(new_fpath, src):
                    rel = f"/static/snapshots/{new_fname}"
                    if base_url:
                        return f"{base_url.rstrip('/')}{rel}"
                    return rel
            except Exception as e:
                print(f"[SNAPSHOT][WARN] cannot copy OCR snapshot: {e}")
        # Nếu file đã bị xoá / lỗi -> clear cache và fallback
        if direction_norm == "in":
            last_snapshot_in = ""
        else:
            last_snapshot_out = ""

    # ---- FALLBACK: chụp từ last_frame (giống hành vi cũ) ----
    now = datetime.now()
    ts = now.strftime("%Y%m%d_%H%M%S_%f")[:-3]
    uid_part = (last_scanned_uid_by_direction[direction_norm] or "anon").replace(":", "").replace("|", "")[:24]
    plate_part = (last_detected_plate_in if direction_norm == "in" else last_detected_plate_out) or ""
    plate_norm = _normalize_plate(plate_part) or "nopl"
    fname = f"{direction_norm}_{ts}_{plate_norm}_{uid_part}.jpg"
    fpath = os.path.join(SNAPSHOT_DIR, fname)

    frame = last_frame_in if direction_norm == "in" else last_frame_out
    if frame is None:
        print(f"[SNAPSHOT] No frame cached for direction={direction_norm}")
        return ""

    # Safety net: đảm bảo folder tồn tại (boot đã tạo, nhưng phòng trường hợp)
    try:
        os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    except Exception:
        pass

    if _safe_imwrite(fpath, frame):
        # Trả về absolute URL nếu base_url được cấu hình, ngược lại relative path
        rel = f"/static/snapshots/{fname}"
        if base_url:
            return f"{base_url.rstrip('/')}{rel}"
        return rel
    return ""


# ==== FLASK ====
app = Flask(__name__)


@app.before_request
def _cache_host_url():
    """Cache lại host URL gần nhất để background thread (camera_loop) dùng
    khi cần trả về absolute URL cho ảnh snapshot."""
    global _last_bridge_host
    try:
        _last_bridge_host = request.host_url.rstrip("/")
    except Exception:
        pass


# Cho phép frontend (localhost:3000) embed ảnh camera trực tiếp
# và gọi các endpoint RFID scan realtime + barrier control.
try:
    from flask_cors import CORS  # type: ignore
    CORS(
        app,
        resources={
            r"/static/*": {"origins": "*"},
            r"/logs": {"origins": "*"},
            r"/api/cameras*": {"origins": "*"},
            r"/api/rfid/*": {"origins": "*"},
            r"/gate/*": {"origins": "*"},
        },
    )
except ImportError:
    # Fallback thủ công nếu flask_cors chưa cài
    @app.after_request
    def _add_cors(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response


@app.route("/api/cameras")
def api_cameras():
    """Liệt kê các camera streams khả dụng cho frontend embed."""
    base = request.host_url.rstrip("/")
    return jsonify({
        "ok": True,
        "cameras": [
            {
                "id": "in",
                "gate": "entry",
                "name": "Cổng vào",
                "snapshotUrl": f"{base}/static/cam_in.jpg",
                "streamUrl": f"{base}/video_feed/in",
            },
            {
                "id": "out",
                "gate": "exit",
                "name": "Cổng ra",
                "snapshotUrl": f"{base}/static/cam_out.jpg",
                "streamUrl": f"{base}/video_feed/out",
            },
        ],
    })


@app.route("/api/cameras/health")
def api_cameras_health():
    """Health check cho camera bridge + trạng thái AI/RAM."""
    rss = _process_rss_mb()
    _ai_metrics["rss_mb"] = round(rss, 1)
    degraded = _is_ai_degraded()
    status = "degraded" if degraded else "ok"
    return jsonify({
        "ok": not degraded,
        "status": status,
        "bridge_url": request.host_url.rstrip("/"),
        "backend_url": BACKEND_URL,
        "backend_healthy": backend.health(),
        "ocr_enabled": OCR_ENABLED,
        "plate_detector": PLATE_DETECTOR,
        "yolo_loaded": yolo_model is not None,
        "scheduler_mode": OCR_SCHEDULER_MODE,
        "ai": {
            "rss_mb": _ai_metrics.get("rss_mb", 0),
            "frames_dropped": _ai_metrics.get("frames_dropped", 0),
            "inferences": _ai_metrics.get("inferences", 0),
            "last_inference_ms": _ai_metrics.get("last_inference_ms", 0),
            "bg_submitted": _ai_metrics.get("bg_submitted", 0),
            "bg_dropped": _ai_metrics.get("bg_dropped", 0),
            "bg_pending": _ai_metrics.get("bg_pending", 0),
            "ocr_busy": _ai_metrics.get("ocr_busy", False),
            "degraded": degraded,
            "degraded_reason": _ai_degraded_reason if degraded else "",
            "memory_soft_limit_mb": AI_MEMORY_SOFT_LIMIT_MB,
        },
    })


# ==== MJPEG live stream ====
# Trả multipart/x-mixed-replace để browser render liên tục (realtime ~10-15fps
# tuỳ camera_loop). Frontend chỉ cần <img src="/video_feed/in">.
# Source frame: last_frame_in / last_frame_out do camera_loop cập nhật liên tục.
# Nếu chưa có camera thật → render 1 placeholder JPEG "no signal" thay vì treo.
_NO_SIGNAL_JPEG = None


def _no_signal_jpeg() -> bytes:
    """Tạo (cache) 1 ảnh JPEG 'no signal' để stream khi camera chưa sẵn sàng."""
    global _NO_SIGNAL_JPEG
    if _NO_SIGNAL_JPEG is not None:
        return _NO_SIGNAL_JPEG
    try:
        import numpy as np  # noqa: F401  (chỉ để chắc cv2 dùng được)
        img = None
        # Dùng cv2 để render text lên ảnh đen cho dễ nhìn
        img = cv2.putText(
            np.zeros((480, 640, 3), dtype=np.uint8),
            "NO SIGNAL",
            (180, 250),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.4,
            (200, 200, 200),
            3,
        )
        img = cv2.putText(img, "Camera not connected", (180, 290),
                          cv2.FONT_HERSHEY_SIMPLEX, 0.8, (140, 140, 140), 2)
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if ok:
            _NO_SIGNAL_JPEG = buf.tobytes()
        else:
            _NO_SIGNAL_JPEG = b""
    except Exception:
        _NO_SIGNAL_JPEG = b""
    return _NO_SIGNAL_JPEG


def _jpeg_bytes_from_frame(frame) -> bytes | None:
    """Resize + encode 1 frame numpy BGR → JPEG bytes. Trả None nếu lỗi."""
    if frame is None:
        return None
    try:
        # Resize trước khi encode để giảm CPU显著 (640px thay vì 1280px)
        h, w = frame.shape[:2]
        if STREAM_MAX_WIDTH > 0 and w > STREAM_MAX_WIDTH:
            ratio = STREAM_MAX_WIDTH / w
            frame = cv2.resize(frame, (STREAM_MAX_WIDTH, max(1, int(h * ratio))),
                               interpolation=cv2.INTER_LINEAR)
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        return buf.tobytes() if ok else None
    except Exception:
        return None


# Cache JPEG đã encode theo từng hướng. Nhiều tab/client cùng xem 1 camera sẽ
# dùng chung kết quả encode thay vì mỗi client tự encode — trước đây N client
# = N lần cv2.imencode mỗi frame, rất tốn CPU.
_jpeg_cache: dict[str, tuple[int, bytes]] = {}


def _draw_overlay(frame, boxes):
    """Vẽ bbox YOLO + text OCR lên frame (in-place, trả về frame).

    boxes: list of (x1, y1, x2, y2, conf, ocr_text).
    - Bbox xanh dương = YOLO detect được biển số.
    - Text xanh lá = OCR ra được text (chỉ dán lên bbox đầu tiên).
    Không vẽ gì nếu boxes rỗng.
    """
    if frame is None or not boxes:
        return frame
    try:
        for i, (x1, y1, x2, y2, conf, ocr_text) in enumerate(boxes):
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
            label = f"YOLO {conf:.2f}"
            cv2.putText(frame, label, (x1, max(15, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
            # Chỉ hiện OCR text ở bbox đầu tiên (YOLO thường chỉ 1 bbox)
            if i == 0 and ocr_text:
                cv2.putText(frame, ocr_text, (x1, min(frame.shape[0] - 10, y2 + 22)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
    except Exception:
        pass
    return frame


def _cached_jpeg(direction: str, frame) -> bytes | None:
    """Encode frame nhưng tái sử dụng kết quả nếu frame chưa đổi.

    Nhận diện frame bằng id() — camera_loop luôn gán object mới cho
    last_frame_in/out mỗi lần đọc được, nên id đủ để phát hiện thay đổi.

    Overlay bbox YOLO + OCR text được áp dụng lên BẢN SAO của frame (không
    mutate frame gốc) trước khi encode, để user nhìn thấy trực tiếp trên
    live stream khi có detection.
    """
    if frame is None:
        return None
    key = id(frame)
    cached = _jpeg_cache.get(direction)
    if cached is not None and cached[0] == key:
        return cached[1]
    # Copy nhẹ rồi vẽ overlay lên bản sao, tránh mutate last_frame gốc.
    # boxes được _ocr_worker cập nhật vào global mỗi tick ~0.5s.
    boxes = last_boxes_in if direction == "in" else last_boxes_out
    out = frame
    if boxes:
        out = frame.copy()
        _draw_overlay(out, boxes)
    jpeg = _jpeg_bytes_from_frame(out)
    if jpeg is not None:
        _jpeg_cache[direction] = (key, jpeg)
    return jpeg


def _mjpeg_generator(direction: str):
    """Yield JPEG frames liên tục theo boundary multipart.

    Chống giật:
    - Dùng event-based wait thay vì time.sleep cố định: chỉ yield khi
      camera_loop publish frame MỚI. Tránh gửi đi gửi lại cùng 1 JPEG
      khi OCR chiếm CPU → camera_loop bị block → last_frame đứng.
    - Có timeout max để vẫn phát frame ở FPS mục tiêu khi camera_loop
      chạy chậm (giúp stream "sống", không đứng hình quá lâu).
    """
    placeholder = _no_signal_jpeg()
    frame_event = _stream_events[direction]
    min_interval = 1.0 / MJPEG_FPS if MJPEG_FPS > 0 else 0.08
    # Tick tối đa mỗi lần chờ — đảm bảo luôn phát frame sau khoảng này dù
    # camera_loop chậm. 150ms ~ 6fps tối thiểu, đủ để browser không timeout.
    max_wait = max(min_interval, 0.15)
    while True:
        frame = last_frame_in if direction == "in" else last_frame_out
        jpeg = _cached_jpeg(direction, frame)
        if jpeg is None:
            jpeg = placeholder
        # multipart: mỗi frame là 1 part, browser tự ghép thành video
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n"
               b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n" +
               jpeg + b"\r\n")
        # Chờ frame MỚI — hoặc timeout để vẫn tick ở FPS tối thiểu
        frame_event.wait(timeout=max_wait)
        frame_event.clear()
        # Rate-limit: đảm bảo không vượt quá MJPEG_FPS
        time.sleep(min_interval)


@app.route("/video_feed/<direction>")
def video_feed(direction: str):
    """MJPEG live stream cho camera vào/ra. Dùng như <img src=...> trong HTML."""
    if direction not in ("in", "out"):
        return jsonify({"error": "Invalid direction"}), 400
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        # Connection giữ mở để browser kéo stream liên tục
        "X-Accel-Buffering": "no",
    }
    return Response(
        _mjpeg_generator(direction),
        mimetype="multipart/x-mixed-replace; boundary=frame",
        headers=headers,
    )


@app.route("/logs")
def get_logs():
    """Lấy log camera/RFID gần nhất từ backend."""
    try:
        r = backend.session.get(f"{backend.base_url}/api/camera-logs/logs?limit=20", timeout=5)
        if r.ok:
            return jsonify(r.json().get("logs", []))
    except Exception as e:
        print("[API][LOGS] error:", e)
    return jsonify([])


@app.route("/gate/<direction>/<action>", methods=["POST"])
def control_gate(direction, action):
    if direction not in ["in", "out"] or action not in ["open", "close"]:
        return jsonify({"error": "Invalid command"}), 400
    if action == "open":
        open_gate(direction)
        # Cổng ra giữ mở 7 giây sau thanh toán; cổng vào giữ thời gian mặc định.
        def _auto_close(gate=direction):
            time.sleep(7 if gate == "out" else 5)
            close_gate(gate)
        threading.Thread(target=_auto_close, daemon=True).start()
    else:
        close_gate(direction)
    return jsonify({"status": f"Gate {direction} {action}ed successfully"})


@app.route("/api/rfid/list")
def rfid_list():
    """Trả về danh sách thẻ RFID active từ backend."""
    cards = backend.rfid_export()
    return jsonify(cards)


@app.route("/api/rfid/add", methods=["POST"])
def rfid_add():
    uid = request.form.get("uid", "").strip()
    owner_name = request.form.get("owner_name", "").strip()
    plate = _normalize_plate(request.form.get("plate", ""))
    user_type = request.form.get("user_type", "guest").strip()

    if not uid:
        return jsonify({"success": False, "message": "UID không được để trống"}), 400

    result = backend.rfid_scan_register(uid, owner_name, plate, user_type)
    if result["ok"]:
        send_to_both(f"ADD|{uid}|{owner_name}|{plate}|{user_type}|active")
        return jsonify({"success": True, "message": f"Đã thêm thẻ {uid}"}), 200
    if result.get("code") == "duplicate":
        return jsonify({"success": False, "message": f"UID {uid} đã tồn tại"}), 409
    return jsonify({"success": False, "message": result.get("message", "Lỗi không xác định")}), 500


@app.route("/api/rfid/delete/<uid>", methods=["DELETE"])
def rfid_delete(uid):
    """Xóa thẻ qua backend bằng cách tìm id trước."""
    try:
        card = backend.rfid_lookup_uid(uid)
        if not card:
            return jsonify({"success": False, "message": "Không tìm thấy thẻ"}), 404
        card_id = card.get("id")
        r = backend.session.delete(f"{backend.base_url}/api/rfid/{card_id}", timeout=5)
        if r.ok:
            send_to_both(f"DELETE|{uid}")
            return jsonify({"success": True, "message": f"Đã xóa thẻ {uid}"}), 200
        return jsonify({"success": False, "message": "Backend xóa thất bại"}), 500
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/rfid/disable/<uid>", methods=["POST"])
def rfid_disable(uid):
    try:
        card = backend.rfid_lookup_uid(uid)
        if not card:
            return jsonify({"success": False, "message": "Không tìm thấy thẻ"}), 404
        card_id = card.get("id")
        r = backend.session.post(f"{backend.base_url}/api/rfid/{card_id}/status", json={"status": "inactive"}, timeout=5)
        if r.ok:
            send_to_both(f"DISABLE|{uid}")
            return jsonify({"success": True, "message": f"Đã khóa thẻ {uid}"}), 200
        return jsonify({"success": False, "message": "Backend lỗi"}), 500
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/rfid/enable/<uid>", methods=["POST"])
def rfid_enable(uid):
    try:
        card = backend.rfid_lookup_uid(uid)
        if not card:
            return jsonify({"success": False, "message": "Không tìm thấy thẻ"}), 404
        card_id = card.get("id")
        r = backend.session.post(f"{backend.base_url}/api/rfid/{card_id}/status", json={"status": "active"}, timeout=5)
        if r.ok:
            send_to_both(f"ENABLE|{uid}")
            return jsonify({"success": True, "message": f"Đã mở khóa thẻ {uid}"}), 200
        return jsonify({"success": False, "message": "Backend lỗi"}), 500
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/rfid/update/<uid>", methods=["POST"])
def rfid_update(uid):
    owner_name = request.form.get("owner_name", "").strip()
    plate = _normalize_plate(request.form.get("plate", ""))
    user_type = request.form.get("user_type", "guest").strip()

    try:
        card = backend.rfid_lookup_uid(uid)
        if not card:
            return jsonify({"success": False, "message": "Không tìm thấy thẻ"}), 404
        card_id = card.get("id")
        r = backend.session.patch(
            f"{backend.base_url}/api/rfid/{card_id}",
            json={"ownerName": owner_name, "plate": plate, "userType": user_type},
            timeout=5,
        )
        if r.ok:
            cmd = f"UPDATE|{uid}|{owner_name}|{plate}|{user_type}"
            send_to_both(cmd)
            return jsonify({"success": True, "message": f"Đã cập nhật thẻ {uid}"}), 200
        return jsonify({"success": False, "message": "Backend lỗi"}), 500
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/rfid/scan/start", methods=["POST"])
def start_rfid_scan():
    body = request.get_json(silent=True) or {}
    set_rfid_scan_enabled(True, body.get("direction", "in"), body.get("mode", "gate"))
    return jsonify({"ok": True})


@app.route("/api/rfid/scan/poll")
def poll_rfid_scan():
    direction = _normalize_scan_direction(request.args.get("direction", "in"))
    state = poll_rfid_scan_state(direction)
    timeout = scan_timeout_by_direction[direction]
    if not state["scanEnabled"] and state["scanResult"] is None:
        return jsonify({"status": "idle", "direction": direction})
    if state["scanEnabled"] and timeout is not None and time.time() - state["scanStartTime"] > timeout:
        scan_result_by_direction[direction] = "timeout"
        _stop_rfid_scan(direction)
        state = poll_rfid_scan_state(direction)
    if state["scanResult"] is None:
        return jsonify({"status": "waiting", "direction": direction})
    return jsonify({
        "status": state["scanResult"],
        "uid": state["lastScannedUid"],
        "message": state.get("scanMessage", ""),
        "direction": direction,
    })


@app.route("/api/rfid/scan/cancel", methods=["POST"])
def cancel_rfid_scan():
    body = request.get_json(silent=True) or {}
    direction = body.get("direction")
    if direction in ("in", "out"):
        set_rfid_scan_enabled(False, direction)
    else:
        for scan_direction in ("in", "out"):
            set_rfid_scan_enabled(False, scan_direction)
    return jsonify({"ok": True})


@app.route("/api/rfid/sync", methods=["POST"])
def trigger_rfid_sync():
    """
    Trigger đồng bộ toàn bộ thẻ từ backend xuống ESP32 ngay lập tức.
    Dùng khi backend vừa khởi động lại hoặc thẻ mới thêm mà ESP32 chưa nhận.
    Trả về số thẻ đã gửi (IN=True/False, OUT=True/False).
    """
    try:
        sent_in, sent_out = sync_all_rfid_cards_to_esp32_with_stats()
        if sent_in == 0 and sent_out == 0:
            return jsonify({
                "ok": False,
                "sent_in": 0,
                "sent_out": 0,
                "message": "Backend chưa phản hồi hoặc không có thẻ nào."
            }), 502
        return jsonify({
            "ok": True,
            "sent_in": sent_in,
            "sent_out": sent_out
        })
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 500


# ==== MAIN ====
if __name__ == "__main__":
    print(f"[BOOT] Backend URL: {BACKEND_URL}")
    print(f"[BOOT] Backend healthy: {backend.health()}")
    print(f"[BOOT] Static dir: {STATIC_DIR}")
    print(f"[BOOT] Snapshot dir: {SNAPSHOT_DIR}")

    # Đảm bảo folder tồn tại
    try:
        os.makedirs(STATIC_DIR, exist_ok=True)
        os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    except Exception as e:
        print("[BOOT][WARN] Cannot create folders:", e)

    threading.Thread(target=camera_loop, daemon=True).start()
    if AI_METRIC_INTERVAL_SEC > 0:
        threading.Thread(target=_metric_logger_loop, name="ai-metric", daemon=True).start()

    def delayed_sync():
        try:
            time.sleep(5)
            sync_all_rfid_cards_to_esp32()
        except Exception as e:
            print("[BOOT_SYNC][ERROR]", e)

    threading.Thread(target=delayed_sync, daemon=True).start()

    # In danh sách routes liên quan camera để user xác nhận MJPEG đã được mount.
    # Nếu không thấy /video_feed/... → service chưa reload sau khi sửa code.
    cam_routes = sorted({
        r.rule for r in app.url_map.iter_rules()
        if "video_feed" in r.rule or "cameras" in r.rule
    })
    print(f"[BOOT] Camera routes: {cam_routes}")
    print(f"[BOOT] Test MJPEG: curl http://localhost:{FLASK_PORT}/video_feed/in")
    print(
        f"[BOOT] AI detector={PLATE_DETECTOR} scheduler={OCR_SCHEDULER_MODE} "
        f"yolo_loaded={yolo_model is not None} "
        f"yolo_max_w={YOLO_MAX_WIDTH} imgsz={YOLO_IMGSZ} "
        f"snapshot_valid_only={SNAPSHOT_ON_VALID_PLATE_ONLY}"
    )

    app.run(debug=False, host="0.0.0.0", port=FLASK_PORT)

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

# OCR_ENABLED=false -> KHÔNG import easyocr/torch. Dùng để test camera thuần
# (EasyOCR + torch tốn ~500MB RAM và là nguyên nhân chính gây lag CPU).
OCR_ENABLED = os.getenv("OCR_ENABLED", "true").strip().lower() not in (
    "0", "false", "no", "off",
)

import cv2
import re
import time
import serial
import threading
import requests
from datetime import datetime
from flask import Flask, Response, jsonify, request

if OCR_ENABLED:
    import torch
    from ultralytics import YOLO
    # PaddleOCR tốt hơn EasyOCR cho biển số xe:
    # - Hỗ trợ tiếng Việt + latin tốt, ít nhầm A↔4, 0↔D, B↔8.
    # - Mobile model ~5MB, chạy CPU nhanh hơn EasyOCR ~2-3 lần.
    # - Whitelist ký tự dễ dàng (chỉ 0-9 + A-Z).
    from paddleocr import PaddleOCR
    paddle_ocr = None  # lazy-init sau khi YOLO sẵn sàng (xem bên dưới)

    # Giới hạn thread ở tầng runtime (bổ sung cho env var phía trên).
    try:
        torch.set_num_threads(int(_TORCH_THREADS))
    except Exception:
        pass
else:
    PaddleOCR = None
    torch = None
    YOLO = None
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

# Dùng đường dẫn tuyệt đối theo thư mục app.py để không phụ thuộc CWD
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(_BASE_DIR, "static")
SNAPSHOT_DIR = os.path.join(STATIC_DIR, "snapshots")

# Flask local port (cho giao diện web + RFID management UI)
FLASK_PORT = int(os.getenv("FLASK_PORT", "5050"))

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
            return {
                "ok": r.ok,
                "status_code": r.status_code,
                "data": data,
            }
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
            status = card.get("status", "active")
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
            f"(backend={CAMERA_BACKEND}). OCR will be skipped for this slot."
        )
        return None
    # Giảm buffer nội bộ để giảm độ trễ + fail streak ngắn hơn khi reconnect.
    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass
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


def _reconnect(index):
    """Thử mở lại camera; trả về cap mới hoặc None nếu vẫn fail."""
    return _open_camera(index)


print(
    f"[CAM] Using CAMERA_INDEX_IN={CAMERA_INDEX_IN}, "
    f"CAMERA_INDEX_OUT={CAMERA_INDEX_OUT}, backend={CAMERA_BACKEND}"
)
cap_in = _open_camera(CAMERA_INDEX_IN)
cap_out = _open_camera(CAMERA_INDEX_OUT)

# Chỉ load PaddleOCR khi OCR được bật — model ~5MB, nhanh hơn EasyOCR.
# use_angle_cls=False: biển số xe đã được YOLO crop vuông, không cần xoay.
# lang='en': latin alphabet (A-Z + 0-9) đủ cho biển số VN, nhẹ hơn 'vi' nhiều.
# show_log=False: tránh spam PaddleOCR info log ra stdout.
paddle_ocr = PaddleOCR(use_angle_cls=False, lang='en', show_log=False) if OCR_ENABLED else None

# YOLO model cho detect bbox biển số — chạy nhanh (~20-50ms) trên CPU.
# Sau khi YOLO tìm được bbox, crop ra rồi đưa vào PaddleOCR đọc text.
# PyTorch >=2.6 đổi `torch.load(weights_only=True)` mặc định → block load
# pickle có custom class (ultralytics DetectionModel). best.pt ở đây là
# file local tin cậy nên ép weights_only=False qua wrapper.
YOLO_MODEL_PATH = os.path.join(_BASE_DIR, "yolo_model", "best.pt")
if OCR_ENABLED and YOLO is not None:
    try:
        import torch.serialization as _torch_ser

        _orig_torch_load = _torch_ser.load

        def _torch_load_unsafe(*args, **kwargs):
            """Cho phép load pickle chứa class ultralytics — best.pt là file local."""
            kwargs.setdefault("weights_only", False)
            return _orig_torch_load(*args, **kwargs)

        # Patch cả 2 vị trí ultralytics có thể gọi (torch.load trực tiếp + torch.serialization.load)
        import torch as _torch
        _torch.load = _torch_load_unsafe
        _torch_ser.load = _torch_load_unsafe
    except Exception as _e:
        print(f"[YOLO][WARN] cannot patch torch.load: {_e}")
    yolo_model = YOLO(YOLO_MODEL_PATH)
else:
    yolo_model = None
YOLO_CONF_THR = float(os.getenv("YOLO_CONF_THR", "0.25"))

if yolo_model is not None:
    print(f"[YOLO] Loaded model from {YOLO_MODEL_PATH}")
else:
    print("[YOLO] DISABLED — YOLO not loaded (OCR_ENABLED=false or ultralytics missing).")

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
_PENDING_TIMEOUT = 60  # giây — nếu quá thời gian này thì coi như pending_vehicle_info hết hạn
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


def set_rfid_scan_enabled(value: bool, direction: str = "in"):
    direction = _normalize_scan_direction(direction)
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


def process_frame(frame, plate_counter, last_plate, last_seen_time, prefix, ser, lock=None, direction="in"):
    global last_boxes_in, last_boxes_out
    # OCR tắt -> trả frame nguyên bản, không tốn CPU.
    if not OCR_ENABLED or paddle_ocr is None:
        return frame, plate_counter, last_plate, last_seen_time, "", ""

    detected_snap = ""
    is_in = (direction == "in")

    # ---- BƯỚC 1: YOLO detect bbox biển số (chạy nhanh ~20-50ms) ----
    if yolo_model is not None:
        results = yolo_model(frame, conf=YOLO_CONF_THR, verbose=False)
        boxes = []
        if results and len(results) > 0:
            for r in results:
                if r.boxes is not None and len(r.boxes) > 0:
                    for box in r.boxes:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        conf = float(box.conf[0])
                        boxes.append((int(x1), int(y1), int(x2), int(y2), conf))

        if not boxes:
            # Không tìm thấy bbox -> clear overlay boxes, skip OCR/chụp
            if is_in:
                last_boxes_in = []
            else:
                last_boxes_out = []
            return frame, plate_counter, last_plate, last_seen_time, "", ""

        # Log confidences để debug khi bị thấp (0.3-0.5 hay gặp với biển số)
        confs = [b[4] for b in boxes]
        max_conf = max(confs) if confs else 0.0
        # Chỉ log khi conf thấp để tránh spam
        if max_conf < 0.5:
            print(f"[YOLO][{direction}] confs={confs} (max={max_conf:.2f}, thr={YOLO_CONF_THR})")

        # Vẽ bbox YOLO lên frame (debug visual) - chỉ vẽ tạm trên frame copy
        for (x1, y1, x2, y2, conf) in boxes:
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
            cv2.putText(frame, f"YOLO {conf:.2f}", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)

        # Lưu boxes vào global để MJPEG stream vẽ overlay lên last_frame.
        # Tuple (x1, y1, x2, y2, conf, ocr_text). ocr_text ban đầu rỗng,
        # sẽ được cập nhật sau khi OCR xong (nếu ra được text).
        overlay_boxes = [
            (x1, y1, x2, y2, conf, "") for (x1, y1, x2, y2, conf) in boxes
        ]
        if is_in:
            last_boxes_in = overlay_boxes
        else:
            last_boxes_out = overlay_boxes

        # ---- BƯỚC 2: CHỤP crop + full frame ra đĩa (bằng chứng) ----
        # Lưu 1 lần duy nhất cho lần detect này, dùng bbox đầu tiên
        # (YOLO thường chỉ trả 1 bbox cho biển số).
        first_box = boxes[0]
        x1, y1, x2, y2, _ = first_box
        h_img, w_img = frame.shape[:2]
        pad = 10
        cx1 = max(0, x1 - pad)
        cy1 = max(0, y1 - pad)
        cx2 = min(w_img, x2 + pad)
        cy2 = min(h_img, y2 + pad)
        crop = frame[cy1:cy2, cx1:cx2]

        if crop.size > 0:
            # CHỤP trước, đặt tên tạm "nopl" — sẽ giữ nguyên nếu OCR ra
            # được plate hợp lệ. Lưu NGAY khi detect để có bằng chứng kể
            # cả khi OCR sau đó fail.
            detected_snap = _save_plate_snapshot(
                crop, frame, direction, plate_hint=""
            )

            # ---- BƯỚC 3: PaddleOCR đọc text trên crop trong RAM ----
            # PaddleOCR.ocr() trả về List[List[Tuple[bbox, (text, prob)]]]
            # nếu có kết quả, hoặc [None] nếu không. Format khác EasyOCR
            # nên phải adapt.
            # cls=False: đã disable angle classifier khi init nên không cần.
            ocr_raw = paddle_ocr.ocr(crop, cls=False)
            if ocr_raw and ocr_raw[0] is not None:
                ocr_results = ocr_raw[0]  # list of (bbox, (text, prob))
            else:
                ocr_results = []
        else:
            ocr_results = []

        parts_all = []
        for item in ocr_results:
            # PaddleOCR item: (bbox, (text, prob)) — bbox là list 4 điểm
            bbox_ocr, (text, prob) = item
            text_clean = re.sub(r'[^A-Z0-9]', '', text.upper())
            if len(text_clean) >= 2 and prob > 0.3:
                parts_all.append(text_clean)
                # Vẽ kết quả OCR lên frame (tọa độ gốc)
                if bbox_ocr is not None and len(bbox_ocr) >= 2:
                    tl = bbox_ocr[0]
                    br = bbox_ocr[2]
                    pt1 = (int(tl[0]) + cx1, int(tl[1]) + cy1)
                    pt2 = (int(br[0]) + cx1, int(br[1]) + cy1)
                    cv2.rectangle(frame, pt1, pt2, (0, 255, 0), 2)
                    cv2.putText(frame, text_clean, (pt1[0], pt1[1] - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        if len(parts_all) == 1:
            candidate = parts_all[0]
        elif len(parts_all) >= 2:
            candidate = parts_all[0] + "".join(parts_all[1:])
        else:
            candidate = None

        # Cập nhật text OCR vào overlay_boxes để MJPEG stream hiển thị
        # luôn biển số ngay khi YOLO detect (không cần đợi cooldown).
        if candidate and yolo_model is not None:
            updated = []
            for (bx1, by1, bx2, by2, bconf, _) in overlay_boxes:
                updated.append((bx1, by1, bx2, by2, bconf, candidate))
            if is_in:
                last_boxes_in = updated
            else:
                last_boxes_out = updated

    else:
        # Fallback: không có YOLO -> OCR trên toàn frame
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        scale = 1.0
        if OCR_MAX_WIDTH > 0 and gray.shape[1] > OCR_MAX_WIDTH:
            scale = OCR_MAX_WIDTH / gray.shape[1]
            gray = cv2.resize(
                gray,
                (OCR_MAX_WIDTH, max(1, int(gray.shape[0] * scale))),
                interpolation=cv2.INTER_AREA,
            )
        ocr_raw = paddle_ocr.ocr(gray, cls=False)
        if ocr_raw and ocr_raw[0] is not None:
            results = ocr_raw[0]
        else:
            results = []
        parts_all = []
        for item in results:
            # PaddleOCR item: (bbox, (text, prob))
            _, (text, prob) = item
            text_clean = re.sub(r'[^A-Z0-9]', '', text.upper())
            if len(text_clean) >= 2 and prob > 0.5:
                parts_all.append(text_clean)
        if len(parts_all) == 1:
            candidate = parts_all[0]
        elif len(parts_all) >= 2:
            candidate = parts_all[0] + "".join(parts_all[1:])
        else:
            candidate = None

    # ---- BƯỚC 4: Xác nhận biển số với cooldown ----
    # plate_cooldown_sec: tối thiểu giây giữa 2 lần ACCEPT cùng 1 biển số.
    # Tránh spam khi xe đậu trước camera.
    if candidate and pattern.match(candidate):
        plate_counter[candidate] = plate_counter.get(candidate, 0) + 1
        if (
            plate_counter[candidate] >= required_count
            and candidate != last_plate
            and (time.time() - last_seen_time) > PLATE_COOLDOWN_SEC
        ):
            print(f"{prefix} Biển số:", candidate)
            last_plate = candidate
            last_seen_time = time.time()
            plate_counter.clear()

            # Nếu snapshot chưa có (fallback không-YOLO) thì chụp full frame
            if not detected_snap:
                detected_snap = _save_plate_snapshot(
                    None, frame, direction, plate_hint=candidate
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
        if not result.get("ok"):
            scan_result_by_direction[direction] = "error"
            scan_message_by_direction[direction] = result.get("message") or f"Backend từ chối thẻ (HTTP {result.get('status_code', 0)})."
        else:
            sync_cmd = f"ADD|{uid}|{owner_name}|{current_plate}|{card_user_type}|active"
            send_to_both(sync_cmd)
            if current_plate:
                image_path = capture_snapshot_for_event("in", base_url=_last_bridge_host)
                push_result = backend.push_camera_log(direction="in", detected_plate=current_plate, confidence=0.95, rfid_uid=uid, owner_name=owner_name, plate=current_plate, user_type=card_user_type, image_path=image_path, metadata={"source": "staff-scan", "snapshot": bool(image_path), "isSubscriber": is_subscriber})
                if push_result.get("ok"):
                    open_gate("in")
                    def _auto_close_in():
                        time.sleep(5)
                        close_gate("in")
                    threading.Thread(target=_auto_close_in, daemon=True).start()
                    user_label = "Resident" if is_subscriber else "Guest"
                    scan_message_by_direction[direction] = f"{user_label}: {current_plate} — barrier opened"
                else:
                    scan_result_by_direction[direction] = "error"
                    scan_message_by_direction[direction] = "Không tạo được phiên gửi xe. Barrier không mở."
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
                    time.sleep(5)
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


# ==== CAMERA LOOP ====
def _ocr_worker(frame_copy, plate_counter, last_plate, last_seen_time,
                prefix, ser, lock, direction_key):
    """Chạy OCR (YOLO+EasyOCR) trên bản copy frame — KHÔNG block camera stream.

    Trả về tuple (plate_counter, last_plate, last_seen_time, detected_plate,
    detected_snap_path) qua biến mutable results_dict.
    """
    global last_detected_plate_in, last_detected_plate_out
    global last_snapshot_in, last_snapshot_out
    global pending_vehicle_info
    try:
        _, pc, lp, lst, detected, detected_snap = process_frame(
            frame_copy, plate_counter, last_plate, last_seen_time,
            prefix, ser, lock, direction_key,
        )
        # Ghi kết quả ngược vào dict thread-safe (dict assignment atomic trong CPython)
        _ocr_worker.results[direction_key] = (pc, lp, lst, detected, detected_snap)
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

        # Khi OCR confirm biển số mới (cooldown đã qua → last_plate vừa đổi),
        # push log lên backend để SSE phát tới /staff-desk ngay lập tức.
        # detected != "" chứng tỏ plate vừa được accept (cooldown + count đủ).
        if detected and detected != last_plate:
            snap_path = detected_snap or ""
            conf_val = 0.0
            # Lấy confidence từ YOLO boxes nếu có
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
            threading.Thread(target=_push_ocr_log, daemon=True).start()

            # ②③④ Bước 2: OCR detect biển số IN → lookup subscriber ngay
            # Lưu kết quả vào pending_vehicle_info để staff quét thẻ dùng luôn.
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
                        # Nếu là xe đã đăng ký hoặc có subscription → push update để UI cập nhật loại xe
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
                        # Fail-safe: KHÔNG cho phép scan nếu lookup lỗi
                        # → tránh ghi nhầm subscriber thành guest
                        pending_vehicle_info = {
                            "plate": plate,
                            "lookupDone": True,
                            "lookupError": True,
                            "isSubscriber": False,
                            "ownerName": "Guest",
                            "vehicle": None,
                            "detectedAt": time.time(),
                        }
                # Khởi tạo trạng thái trước khi chạy lookup nền để không ghi đè
                # kết quả lookup nếu thread hoàn thành rất nhanh.
                pending_vehicle_info = {
                    "plate": detected,
                    "lookupDone": False,
                    "lookupError": False,
                    "isSubscriber": False,
                    "ownerName": "Guest",
                    "vehicle": None,
                    "detectedAt": time.time(),
                }
                threading.Thread(target=_lookup_vehicle_info, daemon=True).start()

    except Exception as e:
        print(f"[OCR][WORKER][ERROR] {direction_key}: {type(e).__name__}: {e}")
        _ocr_worker.results[direction_key] = (
            plate_counter, last_plate, last_seen_time, "", ""
        )

_ocr_worker.results = {}


def camera_loop():
    global plate_counter_in, last_plate_in, last_seen_time_in
    global plate_counter_out, last_plate_out, last_seen_time_out
    global last_frame_in, last_frame_out
    global last_preview_write_in, last_preview_write_out
    global last_detected_plate_in, last_detected_plate_out
    global cap_in, cap_out

    # Thư mục đã được tạo ở boot. Reset interval để lần đầu tiên ghi ngay.
    last_preview_write_in = 0.0
    last_preview_write_out = 0.0

    # Backoff state cho mỗi camera
    camera_loop.fail_in = 0
    camera_loop.fail_out = 0

    # Lần OCR gần nhất của từng camera
    last_ocr_in = 0.0
    last_ocr_out = 0.0

    # Thread OCR đang chạy (1 thread mỗi hướng, tránh đè nhau)
    ocr_thread_in = None
    ocr_thread_out = None

    while True:
        # ===== BƯỚC 1: Đọc frame NHANH — không OCR, không chặn stream =====
        ret_in, frame_in = _safe_read(cap_in)
        if ret_in:
            camera_loop.fail_in = 0
        else:
            camera_loop.fail_in += 1
            if cap_in is not None and camera_loop.fail_in >= 30:
                cap_in.release()
                cap_in = _reconnect(CAMERA_INDEX_IN)
                if cap_in is not None:
                    print("[CAM_IN] Reconnected after fail streak")
                camera_loop.fail_in = 0
            elif cap_in is None and camera_loop.fail_in >= 300:
                cap_in = _reconnect(CAMERA_INDEX_IN)
                camera_loop.fail_in = 0

        ret_out, frame_out = _safe_read(cap_out)
        if ret_out:
            camera_loop.fail_out = 0
        else:
            camera_loop.fail_out += 1
            if cap_out is not None and camera_loop.fail_out >= 30:
                cap_out.release()
                cap_out = _reconnect(CAMERA_INDEX_OUT)
                if cap_out is not None:
                    print("[CAM_OUT] Reconnected after fail streak")
                camera_loop.fail_out = 0
            elif cap_out is None and camera_loop.fail_out >= 300:
                cap_out = _reconnect(CAMERA_INDEX_OUT)
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

        # ===== BƯỚC 3: OCR chạy trên bản copy — KHÔNG block stream =====
        if OCR_ENABLED:
            # Cổng VÀO: chạy OCR nếu interval đủ lớn VÀ thread trước đã xong
            if (ret_in and now - last_ocr_in >= OCR_INTERVAL_SEC
                    and (ocr_thread_in is None or not ocr_thread_in.is_alive())):
                last_ocr_in = now
                frame_copy = frame_in.copy()
                ocr_thread_in = threading.Thread(
                    target=_ocr_worker,
                    args=(frame_copy, dict(plate_counter_in), last_plate_in,
                          last_seen_time_in, "IN:", arduino_in, serial_lock_in, "in"),
                    daemon=True,
                )
                ocr_thread_in.start()

            # Cổng RA
            if (ret_out and now - last_ocr_out >= OCR_INTERVAL_SEC
                    and (ocr_thread_out is None or not ocr_thread_out.is_alive())):
                last_ocr_out = now
                frame_copy = frame_out.copy()
                ocr_thread_out = threading.Thread(
                    target=_ocr_worker,
                    args=(frame_copy, dict(plate_counter_out), last_plate_out,
                          last_seen_time_out, "OUT:", arduino_out, serial_lock_out, "out"),
                    daemon=True,
                )
                ocr_thread_out.start()

            # Thu thập kết quả OCR từ worker threads
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
    """Health check cho camera bridge."""
    return jsonify({
        "ok": True,
        "bridge_url": request.host_url.rstrip("/"),
        "backend_url": BACKEND_URL,
        "backend_healthy": backend.health(),
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
        # Tự đóng barie sau 5 giây
        def _auto_close(gate=direction):
            time.sleep(5)
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
    set_rfid_scan_enabled(True, body.get("direction", "in"))
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

    app.run(debug=False, host="0.0.0.0", port=FLASK_PORT)
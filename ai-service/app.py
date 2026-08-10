"""
smart_parking_rut_gon — Phiên bản tích hợp với iPARK Backend (Node.js + MongoDB).

Thay vì dùng SQLite local, service này gọi REST API của backend thông qua
service token (X-Service-Token header). Tất cả dữ liệu thẻ RFID và log
xe vào/ra được lưu trữ trong MongoDB `bai-do-xe`.

Cấu hình (đặt trong file .env hoặc biến môi trường):
- BACKEND_URL: URL của Node backend, mặc định http://localhost:4000
- BRIDGE_SERVICE_TOKEN: token dùng để xác thực với backend
"""

import cv2
import easyocr
import re
import time
import serial
import threading
import os
import sys
import requests
from datetime import datetime
from flask import Flask, Response, jsonify, request

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
SERIAL_PORT_IN = os.getenv("SERIAL_PORT_IN", "COM3")
SERIAL_PORT_OUT = os.getenv("SERIAL_PORT_OUT", "COM5")
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
            return {
                "ok": r.ok,
                "status_code": r.status_code,
                "created": data.get("created", False),
                "card": data.get("card"),
                "code": data.get("code"),
                "message": data.get("message", ""),
            }
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


cap_in = _open_camera(CAMERA_INDEX_IN)
cap_out = _open_camera(CAMERA_INDEX_OUT)

reader = easyocr.Reader(['en', 'vi'])
pattern = re.compile(r"^\d{2}[A-Z]-?\d{4,5}$")
required_count = 3
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

# Cached host URL cho background thread (cập nhật mỗi request)
_last_bridge_host = ""

scan_enabled = False
scan_start_time = 0
scan_timeout = 15
last_scanned_uid = None
scan_result = None


# ==== RFID SCAN POLLING STATE (cho Flask UI) ====
def poll_rfid_scan_state():
    """Trả về dict trạng thái scan để Flask UI poll."""
    return {
        "scanEnabled": scan_enabled,
        "scanResult": scan_result,
        "lastScannedUid": last_scanned_uid,
        "scanStartTime": scan_start_time,
    }


def set_rfid_scan_enabled(value: bool):
    global scan_enabled, scan_start_time, scan_result, last_scanned_uid
    scan_enabled = value
    scan_start_time = time.time() if value else 0
    scan_result = None
    last_scanned_uid = None
    if value:
        send_to_both("SCAN_ON")
    else:
        send_to_both("SCAN_OFF")


# ==== OCR & XỬ LÝ FRAME ====
def process_frame(frame, plate_counter, last_plate, last_seen_time, prefix, ser, lock=None, direction="in"):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    results = reader.readtext(gray)
    parts = []

    for (bbox, text, prob) in results:
        text = re.sub(r'[^A-Z0-9]', '', text.upper())
        if len(text) >= 2 and prob > 0.5:
            parts.append(text)
            (top_left, _, bottom_right, _) = bbox
            top_left = tuple(map(int, top_left))
            bottom_right = tuple(map(int, bottom_right))
            cv2.rectangle(frame, top_left, bottom_right, (0, 255, 0), 2)
            cv2.putText(frame, text, (top_left[0], top_left[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

    candidate = None
    if len(parts) == 1:
        candidate = parts[0]
    elif len(parts) >= 2:
        candidate = parts[0] + "" + "".join(parts[1:])

    if candidate and pattern.match(candidate):
        plate_counter[candidate] = plate_counter.get(candidate, 0) + 1
        if plate_counter[candidate] >= required_count and candidate != last_plate:
            print(f"{prefix} Biển số:", candidate)
            last_plate = candidate
            last_seen_time = time.time()
            plate_counter.clear()

            # OCR CHỈ DETECT biển số — KHÔNG tạo phiên vào/ra ở đây.
            # Phiên chỉ được tạo khi ESP32 gửi DATA,uid,... (chỉ xảy ra khi có
            # RFID scan thật). Việc push log mỗi lần detect biển sẽ tạo
            # hàng chục phiên ảo cho cùng 1 lượt xe, gây spam DB.
            #
            # Vẫn giữ gửi biển số xuống ESP32 (nếu cần) — ESP32 sẽ tự broadcast
            # DATA,... về khi RFID được quét.
            try:
                line = prefix + candidate
                if ser is not None:
                    if lock is None:
                        ser.write((line + "\n").encode())
                    else:
                        safe_write(ser, lock, line)
                    print("Sent to Arduino:", line)
            except Exception as e:
                # Serial lỗi không được giết thread camera_loop.
                print(f"[OCR][ERROR] serial write failed: {type(e).__name__}: {e}")

    if time.time() - last_seen_time > timeout:
        last_plate = ""

    detected = candidate if (candidate and pattern.match(candidate)) else ""
    return frame, plate_counter, last_plate, last_seen_time, detected


# ==== ĐỌC TỪ ARDUINO ====
def read_from_arduino(ser, ser_out=None, direction="in"):
    global scan_enabled, last_scanned_uid, scan_result

    if ser.in_waiting <= 0:
        return

    line = ser.readline().decode(errors="ignore").strip()
    if not line:
        return

    if line.startswith("UID:"):
        print("[SCAN][UID RAW]", line)

    # RFID UID SCAN
    if scan_enabled and line.startswith("UID:"):
        uid = line.replace("UID:", "").strip()
        if not uid:
            return

        result = backend.rfid_scan_register(uid)
        scan_result = "success" if result.get("created") else "duplicate"
        if not result.get("ok"):
            scan_result = "error"
        last_scanned_uid = uid
        scan_enabled = False
        send_to_both("SCAN_OFF")
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
def camera_loop():
    global plate_counter_in, last_plate_in, last_seen_time_in
    global plate_counter_out, last_plate_out, last_seen_time_out
    global last_frame_in, last_frame_out
    global last_preview_write_in, last_preview_write_out
    global last_detected_plate_in, last_detected_plate_out
    # cap_in/cap_out được reassign khi reconnect — phải khai báo global
    # để tránh UnboundLocalError ở dòng _safe_read(cap_in) bên dưới.
    global cap_in, cap_out

    # Thư mục đã được tạo ở boot. Reset interval để lần đầu tiên ghi ngay.
    last_preview_write_in = 0.0
    last_preview_write_out = 0.0

    # Backoff state cho mỗi camera — tránh spam CPU + reconnect sau N lần fail.
    camera_loop.fail_in = 0
    camera_loop.fail_out = 0

    while True:
        # Đọc từng camera; một camera fail không chặn camera còn lại.
        # Nếu cap_in/cap_out là None (chưa cắm camera), _safe_read trả False
        # và ta sleep thay vì spam retry.
        ret_in, frame_in = _safe_read(cap_in)
        if not ret_in:
            camera_loop.fail_in += 1
            if cap_in is not None and camera_loop.fail_in >= 30:
                # ~3 giây fail liên tục ở sleep 100ms — thử reconnect.
                cap_in.release()
                cap_in = _reconnect(CAMERA_INDEX_IN)
                if cap_in is not None:
                    print("[CAM_IN] Reconnected after fail streak")
                camera_loop.fail_in = 0
            elif cap_in is None and camera_loop.fail_in >= 300:
                # Camera None — thử lại mỗi ~30 giây để bắt được khi user cắm vào.
                cap_in = _reconnect(CAMERA_INDEX_IN)
                camera_loop.fail_in = 0
            time.sleep(min(0.05 * (2 ** min(camera_loop.fail_in, 5)), 1.0))
            continue
        camera_loop.fail_in = 0

        ret_out, frame_out = _safe_read(cap_out)
        if not ret_out:
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
            time.sleep(min(0.05 * (2 ** min(camera_loop.fail_out, 5)), 1.0))
            continue
        camera_loop.fail_out = 0

        # OCR chạy realtime (không ghi disk)
        frame_in, plate_counter_in, last_plate_in, last_seen_time_in, detected_in = process_frame(
            frame_in, plate_counter_in, last_plate_in, last_seen_time_in, "IN:", arduino_in, serial_lock_in, "in"
        )
        frame_out, plate_counter_out, last_plate_out, last_seen_time_out, detected_out = process_frame(
            frame_out, plate_counter_out, last_plate_out, last_seen_time_out, "OUT:", arduino_out, serial_lock_out, "out"
        )
        if detected_in:
            last_detected_plate_in = detected_in
        if detected_out:
            last_detected_plate_out = detected_out

        # Cache latest frames (cho việc snapshot khi có RFID/DATA)
        last_frame_in = frame_in
        last_frame_out = frame_out

        # Live preview ghi chậm — chỉ ghi disk mỗi LIVE_PREVIEW_INTERVAL_SEC
        now = time.time()
        if now - last_preview_write_in >= LIVE_PREVIEW_INTERVAL_SEC:
            _safe_imwrite(os.path.join(STATIC_DIR, "cam_in.jpg"), frame_in)
            last_preview_write_in = now
        if now - last_preview_write_out >= LIVE_PREVIEW_INTERVAL_SEC:
            _safe_imwrite(os.path.join(STATIC_DIR, "cam_out.jpg"), frame_out)
            last_preview_write_out = now

        read_from_arduino(arduino_in, ser_out=arduino_out, direction="in")
        read_from_arduino(arduino_out, direction="out")

        time.sleep(0.1)


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

    direction: "in" | "out"
    base_url: nếu truyền vào, trả về absolute URL để frontend backend hiển thị được.
    """
    now = datetime.now()
    direction_norm = (direction or "").lower().strip()
    if direction_norm not in ("in", "out"):
        direction_norm = "in"

    ts = now.strftime("%Y%m%d_%H%M%S_%f")[:-3]
    uid_part = (last_scanned_uid or "anon").replace(":", "").replace("|", "")[:24]
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
    """Encode 1 frame numpy BGR → JPEG bytes. Trả None nếu lỗi."""
    if frame is None:
        return None
    try:
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        return buf.tobytes() if ok else None
    except Exception:
        return None


def _mjpeg_generator(direction: str):
    """Yield JPEG frames liên tục theo boundary multipart. Mỗi frame ~70-150ms
    tuỳ tốc độ camera_loop. Nếu frame chưa sẵn → phát 'no signal' placeholder."""
    last_emit = 0.0
    placeholder = _no_signal_jpeg()
    while True:
        frame = last_frame_in if direction == "in" else last_frame_out
        jpeg = _jpeg_bytes_from_frame(frame) if frame is not None else None
        if jpeg is None:
            jpeg = placeholder
        # multipart: mỗi frame là 1 part, browser tự ghép thành video
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n"
               b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n" +
               jpeg + b"\r\n")
        # Cap ~15fps để tránh spam khi camera thật quá nhanh
        time.sleep(0.066)


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
    set_rfid_scan_enabled(True)
    return jsonify({"ok": True})


@app.route("/api/rfid/scan/poll")
def poll_rfid_scan():
    state = poll_rfid_scan_state()
    if not state["scanEnabled"] and state["scanResult"] is None:
        return jsonify({"status": "idle"})
    if state["scanEnabled"] and time.time() - state["scanStartTime"] > scan_timeout:
        set_rfid_scan_enabled(False)
        state["scanResult"] = "timeout"
    if state["scanResult"] is None:
        return jsonify({"status": "waiting"})
    return jsonify({"status": state["scanResult"], "uid": state["lastScannedUid"]})


@app.route("/api/rfid/scan/cancel", methods=["POST"])
def cancel_rfid_scan():
    set_rfid_scan_enabled(False)
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
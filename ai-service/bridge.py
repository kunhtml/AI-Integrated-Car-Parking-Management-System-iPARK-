"""
iPARK Camera Bridge Service — Flask service tích hợp camera USB + ESP32 barrier.

Service này:
- Chạy trên port 5050 (Flask)
- Capture từ USB camera (DSHOW/MSMF backend)
- Stream MJPEG live (/video_feed/{gate})
- Điều khiển barrier qua serial (ESP32 Arduino)
- Gọi backend API với service token để push logs
- Health check endpoint

Cấu hình (đặt trong file .env hoặc biến môi trường):
- BACKEND_URL: URL của Node backend, mặc định http://localhost:4000
- BRIDGE_SERVICE_TOKEN: token dùng để xác thực với backend
- CAMERA_IN_PORT: COM port cho camera vào (mặc định 0 = USB cam 0)
- CAMERA_OUT_PORT: COM port cho camera ra (mặc định 1 = USB cam 1)
- ESP32_IN_PORT: COM port cho ESP32 cổng vào (mặc định COM3)
- ESP32_OUT_PORT: COM port cho ESP32 cổng ra (mặc định COM5)
"""

import cv2
import time
import serial
import threading
import os
import requests
from datetime import datetime
from pathlib import Path
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

# ── Config ──
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:4000")
SERVICE_TOKEN = os.environ.get("BRIDGE_SERVICE_TOKEN", "dev_bridge_token_change_me")
CAMERA_IN_PORT = int(os.environ.get("CAMERA_IN_PORT", "0"))
CAMERA_OUT_PORT = int(os.environ.get("CAMERA_OUT_PORT", "1"))
ESP32_IN_PORT = os.environ.get("ESP32_IN_PORT", "COM3")
ESP32_OUT_PORT = os.environ.get("ESP32_OUT_PORT", "COM5")
SNAPSHOT_DIR = Path("snapshots")
SNAPSHOT_DIR.mkdir(exist_ok=True)

# ── Backend Client ──
class BackendClient:
    """HTTP client gọi iPARK backend với service token."""

    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "X-Service-Token": token,
            "Content-Type": "application/json",
        })

    def push_camera_log(
        self,
        direction: str,
        detected_plate: str,
        confidence: float = 0.0,
        rfid_uid: str | None = None,
        owner_name: str | None = None,
        plate: str | None = None,
        user_type: str = "unknown",
        image_path: str | None = None,
        barrier_opened: bool = False,
    ) -> dict | None:
        """Push camera log lên backend, tạo/checkout session tự động."""
        try:
            payload = {
                "direction": direction,
                "detectedPlate": detected_plate,
                "confidence": confidence,
                "userType": user_type,
                "barrierOpened": barrier_opened,
            }
            if rfid_uid:
                payload["rfidUid"] = rfid_uid
            if owner_name:
                payload["ownerName"] = owner_name
            if plate:
                payload["plate"] = plate
            if image_path:
                payload["imagePath"] = image_path

            resp = self.session.post(
                f"{self.base_url}/api/camera-bridge/log",
                json=payload,
                timeout=10,
            )
            if resp.ok:
                return resp.json()
            print(f"[backend] Push log failed: {resp.status_code} {resp.text}")
            return None
        except Exception as e:
            print(f"[backend] Push log error: {e}")
            return None

    def health_check(self) -> bool:
        """Check backend health."""
        try:
            resp = self.session.get(f"{self.base_url}/api/health", timeout=5)
            return resp.ok
        except Exception:
            return False


backend = BackendClient(BACKEND_URL, SERVICE_TOKEN)

# ── Serial (ESP32) ──
arduino_in = None
arduino_out = None
serial_lock = threading.Lock()

def init_serial():
    """Khởi tạo kết nối serial với ESP32."""
    global arduino_in, arduino_out
    try:
        arduino_in = serial.Serial(ESP32_IN_PORT, 9600, timeout=1)
        print(f"[serial] ESP32 IN connected on {ESP32_IN_PORT}")
    except Exception as e:
        print(f"[serial] ESP32 IN not available: {e}")
        arduino_in = None

    try:
        arduino_out = serial.Serial(ESP32_OUT_PORT, 9600, timeout=1)
        print(f"[serial] ESP32 OUT connected on {ESP32_OUT_PORT}")
    except Exception as e:
        print(f"[serial] ESP32 OUT not available: {e}")
        arduino_out = None

def send_serial_command(port: str, command: str) -> bool:
    """Gửi lệnh tới ESP32 (OPEN_IN, CLOSE_IN, OPEN_OUT, CLOSE_OUT)."""
    global arduino_in, arduino_out
    with serial_lock:
        try:
            if port == "in" and arduino_in:
                arduino_in.write(f"{command}\n".encode())
                time.sleep(0.1)
                return True
            elif port == "out" and arduino_out:
                arduino_out.write(f"{command}\n".encode())
                time.sleep(0.1)
                return True
        except Exception as e:
            print(f"[serial] Send command error ({port}): {e}")
    return False

def open_gate(direction: str) -> bool:
    """Mở barrier cổng vào/ra."""
    cmd = f"OPEN_{direction.upper()}"
    return send_serial_command(direction, cmd)

def close_gate(direction: str) -> bool:
    """Đóng barrier cổng vào/ra."""
    cmd = f"CLOSE_{direction.upper()}"
    return send_serial_command(direction, cmd)

# ── Camera ──
cameras = {}
camera_locks = {"in": threading.Lock(), "out": threading.Lock()}
camera_frames = {"in": None, "out": None}

def open_camera(direction: str, port: int) -> cv2.VideoCapture | None:
    """Mở camera USB (DSHOW/MSMF backend)."""
    try:
        # Thử DSHOW trước (Windows)
        cap = cv2.VideoCapture(port, cv2.CAP_DSHOW)
        if not cap.isOpened():
            # Fallback sang MSMF
            cap = cv2.VideoCapture(port, cv2.CAP_MSMF)
        if not cap.isOpened():
            # Fallback sang default
            cap = cv2.VideoCapture(port)

        if cap.isOpened():
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_FPS, 30)
            print(f"[camera] {direction} opened on port {port}")
            return cap
        print(f"[camera] {direction} failed to open on port {port}")
        return None
    except Exception as e:
        print(f"[camera] {direction} error: {e}")
        return None

def capture_frame(direction: str) -> bytes | None:
    """Capture 1 frame từ camera, trả về JPEG bytes."""
    lock = camera_locks[direction]
    with lock:
        cap = cameras.get(direction)
        if not cap or not cap.isOpened():
            return None
        ret, frame = cap.read()
        if not ret:
            return None
        # Encode JPEG
        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        camera_frames[direction] = buffer.tobytes()
        return camera_frames[direction]

def camera_loop(direction: str, port: int):
    """Vòng lặp capture camera, tự động reconnect nếu mất."""
    global cameras
    backoff = 1
    while True:
        try:
            cap = open_camera(direction, port)
            if not cap:
                time.sleep(backoff)
                backoff = min(backoff * 2, 10)
                continue

            cameras[direction] = cap
            backoff = 1  # Reset backoff

            while True:
                frame = capture_frame(direction)
                if frame is None:
                    break
                time.sleep(0.033)  # ~30fps

            # Camera lost, close and retry
            cap.release()
            cameras[direction] = None
            print(f"[camera] {direction} lost, reconnecting...")
            time.sleep(1)

        except Exception as e:
            print(f"[camera] {direction} loop error: {e}")
            time.sleep(2)

def save_snapshot(direction: str, plate: str) -> str | None:
    """Lưu snapshot camera vào file, trả về path."""
    frame = camera_frames.get(direction)
    if not frame:
        return None
    try:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{direction}_{plate}_{ts}.jpg"
        filepath = SNAPSHOT_DIR / filename
        with open(filepath, "wb") as f:
            f.write(frame)
        return str(filepath)
    except Exception as e:
        print(f"[snapshot] Save error: {e}")
        return None

# ── Flask App ──
app = Flask(__name__)
CORS(app)

@app.route("/api/cameras/health")
def health():
    """Health check endpoint."""
    backend_ok = backend.health_check()
    return jsonify({
        "ok": True,
        "service": "ipark-bridge",
        "backend": "ipark-backend",
        "backendStatus": "online" if backend_ok else "offline",
        "cameras": {
            "in": cameras.get("in") is not None,
            "out": cameras.get("out") is not None,
        },
        "timestamp": datetime.now().isoformat(),
    })

@app.route("/api/cameras")
def list_cameras():
    """List cameras với status."""
    return jsonify([
        {
            "id": "in",
            "name": "Cổng vào",
            "direction": "in",
            "status": "online" if cameras.get("in") else "offline",
        },
        {
            "id": "out",
            "name": "Cổng ra",
            "direction": "out",
            "status": "online" if cameras.get("out") else "offline",
        },
    ])

def mjpeg_generator(direction: str):
    """Stream MJPEG từ camera."""
    while True:
        frame = camera_frames.get(direction)
        if frame:
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
        time.sleep(0.033)  # ~30fps

@app.route("/video_feed/<direction>")
def video_feed(direction: str):
    """MJPEG live stream endpoint."""
    if direction not in ["in", "out"]:
        return "Invalid direction", 400
    return Response(
        mjpeg_generator(direction),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )

@app.route("/gate/<direction>/<action>", methods=["POST"])
def gate_control(direction: str, action: str):
    """Điều khiển barrier (open/close)."""
    if direction not in ["in", "out"]:
        return jsonify({"ok": False, "message": "Invalid direction"}), 400
    if action not in ["open", "close"]:
        return jsonify({"ok": False, "message": "Invalid action"}), 400

    if action == "open":
        ok = open_gate(direction)
    else:
        ok = close_gate(direction)

    return jsonify({
        "ok": ok,
        "message": f"Gate {direction} {action} {'success' if ok else 'failed'}",
    })

@app.route("/api/capture/<direction>", methods=["POST"])
def capture(direction: str):
    """Capture snapshot từ camera."""
    if direction not in ["in", "out"]:
        return jsonify({"ok": False, "message": "Invalid direction"}), 400

    plate = request.json.get("plate", "unknown") if request.is_json else "unknown"
    path = save_snapshot(direction, plate)

    if path:
        return jsonify({"ok": True, "path": path})
    return jsonify({"ok": False, "message": "Capture failed"}), 500

# ── Main ──
if __name__ == "__main__":
    print("=" * 60)
    print("iPARK Camera Bridge Service")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Camera IN: port {CAMERA_IN_PORT}")
    print(f"Camera OUT: port {CAMERA_OUT_PORT}")
    print(f"ESP32 IN: {ESP32_IN_PORT}")
    print(f"ESP32 OUT: {ESP32_OUT_PORT}")
    print("=" * 60)

    # Init serial
    init_serial()

    # Start camera threads
    threading.Thread(target=camera_loop, args=("in", CAMERA_IN_PORT), daemon=True).start()
    threading.Thread(target=camera_loop, args=("out", CAMERA_OUT_PORT), daemon=True).start()

    # Run Flask
    app.run(host="0.0.0.0", port=5050, threaded=True)

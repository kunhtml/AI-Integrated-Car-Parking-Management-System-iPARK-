"""Modular Flask runtime entrypoint."""
from __future__ import annotations

import os
import sys
import logging
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env", override=False)
except Exception as exc:
    print(f"[ENV] dotenv unavailable: {exc}")

from flask import Flask, Response, jsonify
from config import FLASK_PORT, STATIC_DIR
from services.orchestration import Orchestrator

try:
    from flask_cors import CORS
except ImportError:
    CORS = None
from rfid.scanner import RfidScanner
from rfid.bridge import RfidSerialBridge
from barrier.controller import BarrierController
from api.health_routes import register_health_routes
from api.barrier_routes import register_barrier_routes
from api.rfid_routes import register_rfid_routes
from api.debug_routes import register_debug_routes

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
# Không in access log cho poll/heartbeat liên tục; Flask vẫn in warning/error.
logging.getLogger("werkzeug").setLevel(logging.WARNING)
if CORS is not None:
    # Phủ TẤT CẢ route (kể cả /gate/*, /stream/* ngoài /api/*).
    # supports_credentials=True vì frontend fetch với credentials: 'include'.
    CORS(app, resources={
        r"/*": {
            "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
            "supports_credentials": True,
        }
    })
orchestrator = Orchestrator(enable_backend=True)
scanner = RfidScanner()
barrier = BarrierController()

register_health_routes(app, orchestrator)
register_barrier_routes(app, barrier)
register_rfid_routes(app, scanner)
register_debug_routes(app, orchestrator)

# Optional serial RFID reader (Arduino/ESP32 qua COM port). Chi bật khi
# RFID_SERIAL_PORT(S) duoc cau hinh; neu khong, van co the nap UID qua HTTP
# POST /api/rfid/scan/record.
def _build_rfid_port_spec() -> str:
    explicit = (
        (os.environ.get("RFID_SERIAL_PORTS") or "").strip()
        or (os.environ.get("RFID_SERIAL_PORT") or "").strip()
    )
    baud = (os.environ.get("RFID_BAUDRATE") or os.environ.get("SERIAL_BAUDRATE") or "9600").strip()

    # Tự dò port COM theo ID thiết bị (ID:IN/ID:OUT) — không phụ thuộc số COM.
    # Bật bằng RFID_AUTO_DETECT=true (mặc định). Tắt để dùng port cứng trong .env.
    auto_detect = os.environ.get("RFID_AUTO_DETECT", "true").strip().lower() not in (
        "0", "false", "no", "off",
    )
    if auto_detect:
        from rfid.bridge import detect_rfid_port_spec
        detected = detect_rfid_port_spec(baudrate=int(baud))
        if detected:
            print(f"[RFID][detect] using auto-detected ports: {detected}")
            return detected
        print("[RFID][detect] auto-detect found nothing; falling back to .env ports")

    if explicit:
        return explicit
    # Fallback: tự ghép từ SERIAL_PORT_IN / SERIAL_PORT_OUT (đã có sẵn trong .env).
    parts = []
    for direction, key in (("in", "SERIAL_PORT_IN"), ("out", "SERIAL_PORT_OUT")):
        port = (os.environ.get(key) or "").strip()
        if port:
            parts.append(f"{direction}={port}:{baud}")
    return ",".join(parts)


rfid_port_spec = _build_rfid_port_spec()
rfid_bridge = None
if rfid_port_spec:
    rfid_bridge = RfidSerialBridge(scanner, port_spec=rfid_port_spec)

@app.get("/api/status")
def status():
    return jsonify({"ok": True, "runtime": "modular", "running": orchestrator.running})

@app.get("/video_feed/<direction>")
def video_feed(direction: str):
    if direction not in {"in", "out"}:
        return jsonify({"ok": False, "error": "invalid direction"}), 400
    def stream():
        import cv2
        import time
        # Đếm viewer để điều tiết OCR: có người xem -> OCR chạy, hết người xem -> pause.
        orchestrator.add_viewer(direction)
        try:
            while orchestrator.running:
                frame = orchestrator.camera.get_display_frame(direction)
                if frame is None:
                    time.sleep(0.05)
                    continue
                ok, encoded = cv2.imencode(".jpg", frame)
                if ok:
                    yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + encoded.tobytes() + b"\r\n")
        finally:
            orchestrator.remove_viewer(direction)
    return Response(stream(), mimetype="multipart/x-mixed-replace; boundary=frame")

if __name__ == "__main__":
    orchestrator.start()
    if rfid_bridge is not None:
        rfid_bridge.start()
        # Dung chung ket noi serial da mo de gui lenh OPEN_GATE/CLOSE_GATE —
        # tranh tranh COM port (Windows chi cho 1 connection moi port).
        for direction, _thread, reader, _stop in rfid_bridge._threads:
            barrier.set_reader(direction, reader)
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=False)

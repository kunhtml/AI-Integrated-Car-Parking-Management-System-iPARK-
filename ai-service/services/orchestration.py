"""Modular runtime coordinator; hardware and Flask remain optional."""
from __future__ import annotations

import os
import threading
import time

from flask import jsonify

from ai.pipeline import PlatePipeline
from backend_client.client import BackendClient
from camera.manager import CameraManager
from evidence.snapshot_store import SnapshotStore
from core.state import state
from config import (
    AI_ENTRY_INFERENCE_INTERVAL_SEC,
    AI_EXIT_INFERENCE_INTERVAL_SEC,
)

class Orchestrator:
    def __init__(self, enable_backend: bool = True):
        self.camera = CameraManager()
        self.pipeline = PlatePipeline()
        self.snapshots = SnapshotStore()
        self.backend = BackendClient() if enable_backend else None
        self.running = False
        self.threads: list[threading.Thread] = []
        # Theo dõi trạng thái frontend staff-desk đang mở.
        # Inference chỉ chạy khi có người xem để tiết kiệm CPU/RAM.
        self._frontend_active = False
        self._frontend_lock = threading.Lock()
        self._last_heartbeat = 0.0
        self._watch_timeout_sec = 30.0
        # Interval tối thiểu giữa 2 lần push lại CÙNG biển số (giây). Xe vẫn
        # nằm trong khung hình sau khi card bị đóng -> frontend khôi phục lại.
        self._re_push_interval_sec = float(
            os.getenv("AI_RE_PUSH_INTERVAL_SEC", "20")
        )
        # Cùng biển có thể quay lại sau khi xe trước đã qua cổng. Chỉ giữ
        # dedupe khi camera còn nhìn thấy liên tục; mất biển đủ lâu thì phiên
        # nhận diện kế tiếp phải được gửi thành event mới.
        self._plate_clear_after_sec = float(
            os.getenv("AI_PLATE_CLEAR_AFTER_SEC", "3")
        )
        # Theo dõi số viewer đang xem stream MJPEG (/video_feed/<direction>).
        # OCR chỉ chạy khi có viewer (hoặc frontend đang watch) để tiết kiệm
        # CPU/RAM — khớp hành vi pause của bản Desktop.
        self._viewers = {"in": 0, "out": 0}
        self._viewers_lock = threading.Lock()
        self._last_pause_log = 0.0
        self._last_run_log = 0.0
        self._status_log_interval_sec = float(
            os.getenv("AI_RUNTIME_STATUS_LOG_SEC", "0")
        )

    def start(self):
        if self.running:
            return
        self.running = True
        self.camera.start()
        # YOLO + PaddleOCR nặng trên CPU; chạy một worker tuần tự để tránh
        # hai camera cùng chiếm toàn bộ CPU/RAM.
        thread = threading.Thread(target=self._worker_loop, daemon=True, name="ai-worker")
        self.threads.append(thread)
        thread.start()

    def _worker_loop(self):
        next_allowed = {"in": 0.0, "out": 0.0}
        inference_interval = {
            "in": max(0.1, AI_ENTRY_INFERENCE_INTERVAL_SEC),
            "out": max(0.1, AI_EXIT_INFERENCE_INTERVAL_SEC),
        }
        while self.running:
            # OCR chỉ chạy khi có người xem stream HOẶC frontend đang watch.
            # Không có ai -> pause inference, chỉ giữ camera chạy (tiết kiệm CPU/RAM).
            active = self._is_frontend_active() or self.total_viewers() > 0
            if not active:
                now = time.time()
                if (
                    self._status_log_interval_sec > 0
                    and now - self._last_pause_log >= self._status_log_interval_sec
                ):
                    self._last_pause_log = now
                    print(
                        f"[AI][PAUSE] no viewers -> OCR paused "
                        f"(in={self.viewer_count('in')} out={self.viewer_count('out')})"
                    )
                time.sleep(0.5)
                continue
            now = time.time()
            if (
                self._status_log_interval_sec > 0
                and now - self._last_run_log >= self._status_log_interval_sec
            ):
                self._last_run_log = now
                print(
                    f"[AI][RUN] viewers in={self.viewer_count('in')} "
                    f"out={self.viewer_count('out')} -> OCR active"
                )
            # Cổng ra cần xác minh/payment trước khi xe có thể đi tiếp, nên
            # luôn lấy frame mới nhất của nó trước. Một worker giữ RAM ổn định.
            for direction in ("out", "in"):
                if now < next_allowed[direction]:
                    continue
                self._process_direction(direction)
                next_allowed[direction] = time.time() + inference_interval[direction]
            time.sleep(0.02)

    # ----- Frontend watch handshake -----
    def _is_frontend_active(self) -> bool:
        with self._frontend_lock:
            if not self._frontend_active:
                return False
            if time.time() - self._last_heartbeat > self._watch_timeout_sec:
                self._frontend_active = False
                return False
            return True

    def mark_frontend_active(self):
        with self._frontend_lock:
            self._frontend_active = True
            self._last_heartbeat = time.time()

    def mark_frontend_inactive(self):
        with self._frontend_lock:
            self._frontend_active = False

    # ----- Viewer tracking (stream /video_feed) -----
    def add_viewer(self, direction: str):
        if direction not in self._viewers:
            return
        with self._viewers_lock:
            self._viewers[direction] += 1
            count = self._viewers[direction]
        print(f"[STREAM] viewer +1 direction={direction} total={count}")

    def remove_viewer(self, direction: str):
        if direction not in self._viewers:
            return
        with self._viewers_lock:
            self._viewers[direction] = max(0, self._viewers[direction] - 1)
            count = self._viewers[direction]
        print(f"[STREAM] viewer -1 direction={direction} total={count}")

    def viewer_count(self, direction: str) -> int:
        with self._viewers_lock:
            return self._viewers.get(direction, 0)

    def total_viewers(self) -> int:
        with self._viewers_lock:
            return sum(self._viewers.values())

    def attach_routes(self, app):
        @app.get("/api/staff-desk/watch")
        def _watch():
            self.mark_frontend_active()
            return jsonify({"ok": True, "active": True})

        @app.post("/api/staff-desk/watch")
        def _watch_post():
            self.mark_frontend_active()
            return jsonify({"ok": True, "active": True})

        @app.post("/api/staff-desk/unwatch")
        def _unwatch():
            self.mark_frontend_inactive()
            return jsonify({"ok": True, "active": False})

        @app.get("/api/staff-desk/status")
        def _status():
            return jsonify({
                "ok": True,
                "active": self._is_frontend_active(),
                "inferenceRunning": self._is_frontend_active() and self.running,
            })

    def _process_direction(self, direction: str):
        if not self.running:
            return
        last_plate = getattr(self, f"_last_plate_{direction}", "")
        last_push_ts = float(getattr(self, f"_last_push_ts_{direction}", 0.0))
        last_seen_ts = float(getattr(self, f"_last_seen_ts_{direction}", 0.0))
        frame = self.camera.get_frame(direction)
        if frame is None:
            return
        try:
            result = self.pipeline.process(frame, direction)
        except Exception as exc:
            print(f"[AI][{direction}] pipeline failed: {exc}")
            return
        now = time.time()
        if not result:
            # Xe đã rời vùng camera. Quên biển cũ để xe cùng biển quay lại
            # vẫn tạo `camera.ingest`, thay vì frontend đứng ở trạng thái chờ.
            if (
                last_plate
                and last_seen_ts
                and now - last_seen_ts >= self._plate_clear_after_sec
            ):
                setattr(self, f"_last_plate_{direction}", "")
            return
        boxes = result.get("boxes", [])
        # Một biển đôi khi có nhiều candidate overlap sau NMS. Preview chỉ
        # vẽ candidate mạnh nhất để không chồng khung/nhãn lên nhau.
        overlay = (
            [dict(max(boxes, key=lambda box: float(box.get("confidence", 0))))]
            if boxes
            else []
        )
        if result.get("plate") and overlay:
            overlay[0]["label"] = result["plate"]
        with state.locks[direction]:
            state.detections[direction] = overlay
        # YOLO có box nhưng OCR chưa đọc được biển: chỉ vẽ khung, chưa emit.
        if not result.get("plate"):
            return
        plate = result["plate"]
        setattr(self, f"_last_seen_ts_{direction}", now)
        # Push khi biển mới HOẶC (cổng ra) cùng biển nhưng đã quá
        # RE_PUSH_INTERVAL — cho phép frontend khôi phục lại card xe ra khi
        # nó bị đóng (dismiss/verify xong) trong khi xe vẫn còn trong khung
        # hình. Cổng vào KHÔNG re-push để không xáo trộn luồng tạo phiên.
        re_push = (
            direction == "out"
            and now - last_push_ts >= self._re_push_interval_sec
        )
        if plate != last_plate or (plate and re_push):
            image_path = self.snapshots.save_full_frame(frame, direction, plate)
            state.detected_plates[direction] = plate
            state.snapshots[direction] = image_path
            setattr(self, f"_last_plate_{direction}", plate)
            setattr(self, f"_last_push_ts_{direction}", now)
            if self.backend:
                self.backend.push_camera_log(
                    direction=direction,
                    detected_plate=plate,
                    image_path=image_path,
                    confidence=result.get("confidence", 0),
                    metadata={"source": "modular-orchestrator", "snapshot": bool(image_path)},
                )

    def stop(self):
        self.running = False
        self.camera.stop()
        for thread in self.threads:
            thread.join(timeout=1)
        self.threads.clear()

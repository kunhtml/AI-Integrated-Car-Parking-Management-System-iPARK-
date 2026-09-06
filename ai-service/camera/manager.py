"""Camera ownership and frame capture, independent from AI inference."""
from __future__ import annotations

import threading
import time
import cv2

from config import CAMERA_IN_INDEX, CAMERA_OUT_INDEX
from core.state import state

class CameraManager:
    def __init__(self):
        self.indices = {"in": CAMERA_IN_INDEX, "out": CAMERA_OUT_INDEX}
        self.captures = {}
        self.running = False
        self.thread = None
        self.threads: dict[str, threading.Thread] = {}

    def start(self):
        if self.running:
            return
        print(
            f"[CAM] mapping IN=index {self.indices['in']} | "
            f"OUT=index {self.indices['out']}"
        )
        self.running = True
        self.threads = {
            direction: threading.Thread(
                target=self._loop_direction,
                args=(direction,),
                daemon=True,
                name=f"camera-{direction}",
            )
            for direction in self.indices
        }
        for thread in self.threads.values():
            thread.start()

    def _open(self, direction: str):
        capture = cv2.VideoCapture(self.indices[direction], cv2.CAP_DSHOW)
        if not capture.isOpened():
            capture.release()
            return None
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return capture

    def _loop_direction(self, direction: str):
        last_error_log = 0.0
        while self.running:
            capture = self.captures.get(direction)
            if capture is None or not capture.isOpened():
                capture = self._open(direction)
                if capture is None:
                    now = time.time()
                    if now - last_error_log >= 3:
                        print(f"[CAM][{direction}] unable to open index {self.indices[direction]}")
                        last_error_log = now
                    time.sleep(0.2)
                    continue
                self.captures[direction] = capture
                print(f"[CAM][{direction}] opened index {self.indices[direction]}")
            ok, frame = capture.read()
            if ok and frame is not None:
                with state.locks[direction]:
                    state.frames[direction] = frame
            else:
                print(f"[CAM][{direction}] frame read failed; reopening")
                capture.release()
                self.captures.pop(direction, None)
            time.sleep(0.01)

    def get_frame(self, direction: str):
        with state.locks[direction]:
            frame = state.frames.get(direction)
            return frame.copy() if frame is not None else None

    def get_display_frame(self, direction: str):
        frame = self.get_frame(direction)
        if frame is None:
            return None
        with state.locks[direction]:
            boxes = list(state.detections.get(direction, []))
        for box in boxes:
            x1, y1 = int(box["x1"]), int(box["y1"])
            x2, y2 = int(box["x2"]), int(box["y2"])
            confidence = float(box.get("confidence", 0.0))
            label = str(box.get("label") or f"YOLO plate {confidence:.0%}")
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 220, 80), 2)
            cv2.putText(frame, label, (x1, max(22, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 220, 80), 2)
        return frame

    def stop(self):
        self.running = False
        for thread in self.threads.values():
            if thread.is_alive():
                thread.join(timeout=1)
        self.threads.clear()
        for capture in self.captures.values():
            capture.release()
        self.captures.clear()

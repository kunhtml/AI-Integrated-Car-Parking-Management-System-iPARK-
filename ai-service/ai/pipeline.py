"""YOLO/OpenCV + OCR pipeline. Does not call backend or control barriers."""
from __future__ import annotations

import cv2

from .yolo_detector import YoloDetector
from .ocr_engine import OcrEngine
from .plate_parser import PlateParser

class PlatePipeline:
    def __init__(self):
        self.detector = YoloDetector()
        self.ocr = OcrEngine()
        self.parser = PlateParser()

    def process(self, frame, direction: str = "in"):
        if frame is None:
            return None
        boxes = self.detector.detect(frame)
        if not boxes:
            return {"direction": direction, "plate": "", "boxes": []}
        for box in boxes:
            crop = frame[max(0, box["y1"]):box["y2"], max(0, box["x1"]):box["x2"]]
            if crop.size == 0:
                continue
            # OCR cần đủ pixel; phóng to crop trong memory, không lưu crop ra disk.
            enlarged = cv2.resize(crop, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
            texts = self.ocr.recognize(enlarged)
            plate = self.parser.normalize(texts)
            if plate:
                print(f"[PLATE][{direction}] {plate} conf={box.get('confidence', 0.0):.3f}")
                return {
                    "direction": direction,
                    "plate": plate,
                    "confidence": box.get("confidence", 0.0),
                    "box": box,
                    "boxes": boxes,
                }
        return {"direction": direction, "plate": "", "boxes": boxes}

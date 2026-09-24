"""YOLO/OpenCV + OCR pipeline. Does not call backend or control barriers."""
from __future__ import annotations

import cv2

from .yolo_detector import YoloDetector
from .ocr_engine import OcrEngine
from .plate_parser import PlateParser
from .ocr_helper import read_plate

class PlatePipeline:
    def __init__(self):
        self.detector = YoloDetector()
        self.ocr = OcrEngine()
        self.parser = PlateParser()

    def process(self, frame, direction: str = "in"):
        if frame is None:
            return None
        boxes = self.detector.detect(frame)
        if boxes:
            for box in boxes:
                crop = frame[max(0, box["y1"]):box["y2"], max(0, box["x1"]):box["x2"]]
                if crop.size == 0:
                    continue
                # OCR vùng crop (hỗ trợ cả biển 1 dòng và 2 dòng)
                raw_text, conf_val = read_plate(crop)
                plate = self.parser.normalize([raw_text])
                if plate:
                    print(f"[PLATE][{direction}] {plate} conf={box.get('confidence', 0.0):.3f}")
                    return {
                        "direction": direction,
                        "plate": plate,
                        "confidence": box.get("confidence", 0.0),
                        "box": box,
                        "boxes": boxes,
                    }

        # Fallback: Nếu YOLO không tìm thấy box hoặc các box đều không chứa biển số hợp lệ,
        # kích hoạt DBNet của PaddleOCR trực tiếp trên toàn khung hình
        raw_full, conf_full = read_plate(frame)
        plate_full = self.parser.normalize([raw_full])
        if plate_full:
            print(f"[PLATE][{direction}][FALLBACK] {plate_full} conf={conf_full}")
            return {
                "direction": direction,
                "plate": plate_full,
                "confidence": float(conf_full) / 100.0,
                "box": None,
                "boxes": boxes or [],
            }

        return {"direction": direction, "plate": "", "boxes": boxes or []}

"""Vẽ bounding box YOLO lên frame + trả về base64 để debug trực quan."""
from __future__ import annotations

import base64
import logging
from typing import Any

import cv2
import numpy as np

from .ocr_helper import read_plate
from .yolo_detector import YoloDetector

logger = logging.getLogger(__name__)


def _encode_jpeg(image: np.ndarray, quality: int = 85) -> str:
    ok, buf = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return ""
    return base64.b64encode(buf.tobytes()).decode("ascii")


def detect_with_bbox(frame, yolo: YoloDetector | None = None) -> dict:
    """Chạy YOLO thuần (không OCR) trên frame, vẽ bbox và trả về dict.

    Returns
    -------
    {
        "boxes": [{"x1","y1","x2","y2","confidence"}, ...],
        "image": "data:image/jpeg;base64,...",   # ảnh đã vẽ bbox
        "width": int,
        "height": int,
    }
    """
    if frame is None:
        return {"boxes": [], "image": "", "width": 0, "height": 0}

    if yolo is None:
        yolo = YoloDetector()
    raw_boxes = yolo.detect(frame)
    h, w = frame.shape[:2]

    # Vẽ overlay. Dùng bản copy để không ảnh hưởng frame gốc.
    canvas = frame.copy()
    for idx, box in enumerate(raw_boxes, start=1):
        x1, y1, x2, y2 = box["x1"], box["y1"], box["x2"], box["y2"]
        conf = float(box.get("confidence", 0.0))
        color = (0, 255, 0)  # xanh lá
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 3)
        label = f"plate #{idx} conf={conf:.2f}"
        (tw, th), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2
        )
        cv2.rectangle(canvas, (x1, max(0, y1 - th - baseline - 6)), (x1 + tw + 6, y1), color, -1)
        cv2.putText(
            canvas,
            label,
            (x1 + 3, y1 - baseline - 3),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 0),
            2,
            cv2.LINE_AA,
        )

    encoded = _encode_jpeg(canvas)
    return {
        "boxes": raw_boxes,
        "image": f"data:image/jpeg;base64,{encoded}" if encoded else "",
        "width": w,
        "height": h,
    }


def detect_with_bbox_ocr(
    frame,
    yolo: YoloDetector | None = None,
    ocr_each_box: bool = True,
) -> dict:
    """YOLO detect plate, với mỗi box sẽ crop → OCR → gắn nhãn text.

    Returns dict gồm:
      - boxes: danh sách bbox + yolo_conf + ocr_text + ocr_conf
      - ocr_results: danh sách text OCR theo thứ tự score cao→thấp
      - image: ảnh jpeg base64 đã vẽ bbox + nhãn OCR
      - crops: list ảnh crop base64 (để hiển thị từng biển)
      - width/height: kích thước ảnh gốc
    """
    if frame is None:
        return {
            "boxes": [],
            "ocr_results": [],
            "image": "",
            "crops": [],
            "width": 0,
            "height": 0,
        }

    if yolo is None:
        yolo = YoloDetector()
    raw_boxes = yolo.detect(frame)
    h, w = frame.shape[:2]

    enriched: list[dict[str, Any]] = []
    crops: list[dict[str, Any]] = []
    ocr_results: list[dict[str, Any]] = []

    for idx, box in enumerate(raw_boxes, start=1):
        x1 = max(0, int(box["x1"]))
        y1 = max(0, int(box["y1"]))
        x2 = min(w, int(box["x2"]))
        y2 = min(h, int(box["y2"]))
        if x2 <= x1 or y2 <= y1:
            continue
        crop = frame[y1:y2, x1:x2]
        ocr_text, ocr_conf = ("", 0)
        if ocr_each_box:
            try:
                ocr_text, ocr_conf = read_plate(crop)
            except Exception as exc:  # pragma: no cover
                logger.warning("OCR failed on box #%s: %s", idx, exc)
        enriched.append(
            {
                "index": idx,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "confidence": float(box.get("confidence", 0.0)),
                "ocr_text": ocr_text,
                "ocr_confidence": int(ocr_conf),
            }
        )
        crop_b64 = _encode_jpeg(crop, quality=90)
        crops.append(
            {
                "index": idx,
                "image": f"data:image/jpeg;base64,{crop_b64}" if crop_b64 else "",
            }
        )
        if ocr_text:
            ocr_results.append(
                {
                    "text": ocr_text,
                    "confidence": int(ocr_conf),
                    "box_index": idx,
                }
            )

    # Sắp xếp OCR theo conf giảm dần để staff lấy text tốt nhất
    ocr_results.sort(key=lambda r: r["confidence"], reverse=True)

    # Vẽ canvas
    canvas = frame.copy()
    for item in enriched:
        x1, y1, x2, y2 = item["x1"], item["y1"], item["x2"], item["y2"]
        conf = item["confidence"]
        ocr_text = item.get("ocr_text", "")
        cv2.rectangle(canvas, (x1, y1), (x2, y2), (0, 255, 0), 3)
        if ocr_text:
            label = f"#{item['index']} {ocr_text} ({item['ocr_confidence']}%)"
        else:
            label = f"#{item['index']} y={conf:.2f}"
        (tw, th), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2
        )
        cv2.rectangle(
            canvas,
            (x1, max(0, y1 - th - baseline - 6)),
            (x1 + tw + 6, y1),
            (0, 255, 0),
            -1,
        )
        cv2.putText(
            canvas,
            label,
            (x1 + 3, y1 - baseline - 3),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 0),
            2,
            cv2.LINE_AA,
        )

    encoded = _encode_jpeg(canvas)
    return {
        "boxes": enriched,
        "ocr_results": ocr_results,
        "image": f"data:image/jpeg;base64,{encoded}" if encoded else "",
        "crops": crops,
        "width": w,
        "height": h,
    }

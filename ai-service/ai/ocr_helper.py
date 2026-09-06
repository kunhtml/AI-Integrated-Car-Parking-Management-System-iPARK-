"""Wrapper nhẹ quanh PaddleOCR dùng cho route debug / staff-desk.

Tách ra để không phụ thuộc vào ``main.py`` legacy, đồng thời có thể tái sử dụng
khi main đang refactor.
"""
from __future__ import annotations

import threading
from typing import Any

import cv2
import numpy as np

_OCR: Any | None = None
_OCR_LOCK = threading.Lock()


def _get_ocr():
    """Lazy init PaddleOCR (chậm, nên tránh load ở import time)."""
    global _OCR
    if _OCR is not None:
        return _OCR
    with _OCR_LOCK:
        if _OCR is None:
            import os  # noqa: WPS433 - import trong lock để tránh thread race
            from paddleocr import PaddleOCR  # type: ignore

            lang = os.environ.get("OCR_LANG", "en")
            _OCR = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
    return _OCR


def _upscale_plate(img_cv: np.ndarray, pad_ratio: float = 0.3, scale: int = 4) -> np.ndarray:
    """Pad + upscale để OCR đọc ảnh biển nhỏ chính xác hơn."""
    h, w = img_cv.shape[:2]
    pad_x = int(w * pad_ratio)
    pad_y = int(h * pad_ratio)
    padded = cv2.copyMakeBorder(
        img_cv, pad_y, pad_y, pad_x, pad_x, cv2.BORDER_REFLECT_101
    )
    return cv2.resize(padded, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def read_plate(img_cv: np.ndarray) -> tuple[str, int]:
    """OCR 1 ảnh crop biển số. Trả về (text, confidence 0-100)."""
    if img_cv is None or img_cv.size == 0:
        return "", 0
    ocr = _get_ocr()
    h, w = img_cv.shape[:2]
    if w < 100 or h < 50:
        img_cv = _upscale_plate(img_cv)
    try:
        result = ocr.ocr(img_cv, cls=True)
    except Exception as exc:  # pragma: no cover - defensive
        return f"[OCR_ERROR:{exc}]", 0
    if not result or not result[0]:
        return "", 0
    words, confs = [], []
    for line in result[0]:
        text = line[1][0].strip()
        conf = line[1][1]
        if text:
            words.append(text)
            confs.append(int(conf * 100))
    raw_text = " ".join(words)
    confidence = int(sum(confs) / len(confs)) if confs else 0
    return raw_text, confidence

"""OCR adapter isolated from camera and barrier concerns."""
from __future__ import annotations

from config import OCR_ENABLED

class OcrEngine:
    def __init__(self):
        self.engine = None
        if OCR_ENABLED:
            try:
                from paddleocr import PaddleOCR
                # PaddleOCR mặc định in 3 dòng debug cho từng frame. Chỉ giữ
                # log biển số đã xác nhận và lỗi để console dùng được khi vận hành.
                self.engine = PaddleOCR(
                    use_angle_cls=True,
                    lang="en",
                    show_log=False,
                )
            except Exception as exc:
                print(f"[OCR] disabled: {exc}")

    def recognize(self, image) -> list[str]:
        if self.engine is None or image is None:
            return []
        try:
            # YOLO đã crop đúng vùng biển số. Không chạy Paddle text-detector
            # lần nữa; chỉ nhận dạng ký tự để giảm độ trễ mỗi frame.
            result = self.engine.ocr(image, det=False, rec=True, cls=True)
            texts = []
            for page in result or []:
                if isinstance(page, dict):
                    for item in page.get("rec_texts", []) or []:
                        texts.append(str(item))
                    continue
                for item in page or []:
                    # `det=False` trả `(text, confidence)` thay vì
                    # `(box, (text, confidence))` như OCR đầy đủ.
                    if (
                        isinstance(item, (list, tuple))
                        and len(item) >= 2
                        and isinstance(item[0], str)
                    ):
                        texts.append(item[0])
                        continue
                    if isinstance(item, (list, tuple)) and len(item) >= 2:
                        value = item[1]
                        texts.append(str(value[0] if isinstance(value, (list, tuple)) else value))
            return texts
        except Exception as exc:
            print(f"[OCR] failed: {exc}")
            return []

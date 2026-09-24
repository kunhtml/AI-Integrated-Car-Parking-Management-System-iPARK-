"""Normalize OCR output into a stable plate identifier."""
from __future__ import annotations

import re

# Pattern biển số Việt Nam:
# Format chuẩn: 2 số đầu (mã tỉnh) + 1-2 chữ cái + 4-5 số (có thể có dấu - . : space).
# Ví dụ hợp lệ: 29A12345, 51F97022, 30F-123.45, 60A-999.99, 27F:222.27
_VN_PLATE_PATTERNS = [
    # Biển 2 dòng hoặc có phân tách 3 số + 2 số: 51F-970.22, 29-A1 123.45, 27F:222.27
    re.compile(r"(\d{2})[-:\s.]*([A-Z]{1,2})\s*(\d?)[-:\s.]*(\d{3})[-:\s.]*(\d{2})"),
    # Biển 1 dòng tiêu chuẩn: 29A12345, 30E-92291, 18A-1234
    re.compile(r"(\d{2})[-:\s.]*([A-Z]{1,2})\s*(\d?)[-:\s.]*(\d{4,5})"),
]

# Pattern kiểm tra lỏng "có cụm biển số"
_VN_PLATE_LOOSE = re.compile(r"\d{2}[-:\s.]*[A-Z]{1,2}\s*\d?[-:\s.]*\d{3,5}")

class PlateParser:
    def normalize(self, parts: list[str] | None) -> str:
        if not parts:
            return ""
        raw = " ".join(p for p in parts if p)
        # Bước 1: Làm sạch các tiền tố debug text (YOLO, CONF, BOX...)
        cleaned = re.sub(r"[^A-Za-z0-9\-\s\.:]", " ", raw).upper().strip()
        cleaned = re.sub(r"\b(YOLO|OLOYOL|CONF|BOX|FPS)\b|\bYOLO[0-9.]*", " ", cleaned)

        # Bước 2: Thử khớp các pattern biển số chuẩn ở bất kỳ vị trí nào trong chuỗi
        for pattern in _VN_PLATE_PATTERNS:
            match = pattern.search(cleaned)
            if match:
                compact = re.sub(r"[^A-Z0-9]", "", match.group(0))
                if 7 <= len(compact) <= 9:
                    return compact

        # Bước 3: Fallback loose match
        loose_match = _VN_PLATE_LOOSE.search(cleaned)
        if loose_match:
            compact = re.sub(r"[^A-Z0-9]", "", loose_match.group(0))
            if 7 <= len(compact) <= 9 and re.match(r"^\d{2}[A-Z]{1,2}\d{3,5}$", compact):
                return compact

        return ""

"""Normalize OCR output into a stable plate identifier."""
from __future__ import annotations

import re

# Pattern biển số Việt Nam — BẮT BUỘC khớp đúng format, không fallback lung tung.
# Format: 2 số đầu (mã tỉnh) + 1-2 chữ cái + 4-5 số (có thể có dấu - . space).
# Ví dụ hợp lệ: 29A12345, 51F97022, 30F-123.45, 60A-999.99
_VN_PLATE_PATTERNS = [
    re.compile(r"^(\d{2})([A-Z]{1,2})(\d?)[-\s.]?(\d{3})[-\s.]?(\d{2})$"),  # 51F-970.22
    re.compile(r"^(\d{2})([A-Z]{1,2})[-\s.]?(\d{4,5})$"),                     # 29A12345
]

# Pattern kiểm tra "có vẻ là biển số" để accept text thô (dùng làm pre-filter).
_VN_PLATE_LOOSE = re.compile(r"\d{2}[A-Z]{1,2}\d?[-\s.]?\d{3,5}")

class PlateParser:
    def normalize(self, parts: list[str] | None) -> str:
        raw = "".join(parts or [])
        # Bước 1: Chuẩn hoá — chỉ giữ alphanumeric + dấu phân cách, uppercase.
        cleaned = re.sub(r"[^A-Za-z0-9\-\s\.]", "", raw).upper().strip()

        # Bước 2: Pre-filter — phải có ÍT NHẤT pattern lỏng giống biển số VN.
        # Nếu không khớp (vd "GOOGLESOMSESRERTEEON", "HTTPNGOGGLE"), BỎ QUA ngay.
        if not _VN_PLATE_LOOSE.search(cleaned):
            return ""

        # Bước 3: Thử khớp pattern nghiêm ngặt.
        for pattern in _VN_PLATE_PATTERNS:
            match = pattern.search(cleaned)
            if match:
                # Trả về dạng compact: bỏ dấu phân cách, 8-9 ký tự.
                digits_letters = re.sub(r"[^A-Z0-9]", "", match.group(0))
                return digits_letters

        # Bước 4: Fallback cuối — chỉ chấp nhận nếu match lỏng VÀ đúng format VN
        # (\d{2}[A-Z]{1,2}\d{3,5}). Loại mọi text dài như "GOOGLESOMSESRERTEEON".
        loose_match = _VN_PLATE_LOOSE.search(cleaned)
        if loose_match:
            compact = re.sub(r"[^A-Z0-9]", "", loose_match.group(0))
            # Biển VN compact: 2 số + 1-2 chữ + 4-5 số = 7-9 ký tự
            if 7 <= len(compact) <= 9 and re.match(r"^\d{2}[A-Z]{1,2}\d{3,5}$", compact):
                return compact

        return ""

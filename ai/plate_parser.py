"""Vietnamese plate text normalization."""
from __future__ import annotations

import re

class PlateParser:
    def normalize(self, parts: list[str]) -> str:
        value = re.sub(r"[^A-Za-z0-9]", "", "".join(parts or [])).upper()
        return value if len(value) >= 5 else ""

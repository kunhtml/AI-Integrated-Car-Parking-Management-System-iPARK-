"""Routes debug: vẽ bounding box YOLO và trả về JSON + ảnh base64."""
from __future__ import annotations

import os
import threading
from pathlib import Path

import cv2
import numpy as np
from flask import jsonify, request

from ai.bbox_draw import detect_with_bbox, detect_with_bbox_ocr
from ai.yolo_detector import YoloDetector


def register_debug_routes(app, orchestrator=None):
    # Lazy-init detector chia sẻ cho route debug; tránh mỗi request tải model.
    state = {"detector": None, "lock": threading.Lock()}

    def _get_detector() -> YoloDetector:
        if state["detector"] is None:
            with state["lock"]:
                if state["detector"] is None:
                    state["detector"] = YoloDetector()
        return state["detector"]

    def _load_image_from_request() -> np.ndarray | None:
        """Đọc ảnh từ multipart 'file' hoặc JSON 'image' base64."""
        if "file" in request.files:
            data = request.files["file"].read()
        else:
            body = request.get_json(silent=True) or {}
            b64 = body.get("image", "")
            if not b64:
                return None
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            try:
                import base64 as _b64
                data = _b64.b64decode(b64)
            except Exception:
                return None
        if not data:
            return None
        arr = np.frombuffer(data, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)

    def _resolve_path(image_path: str) -> Path | None:
        """Cho phép truyền path tuyệt đối hoặc path tương đối tới thư mục
        AI service. Ngăn path traversal ra ngoài project."""
        if not image_path:
            return None
        ai_root = Path(__file__).resolve().parent.parent
        candidate = Path(image_path)
        if not candidate.is_absolute():
            # Thử relative tới ai-service/
            candidate = (ai_root / image_path).resolve()
        else:
            candidate = candidate.resolve()
        # Chỉ cho phép nằm trong thư mục project (parent của ai-service)
        project_root = ai_root.parent.resolve()
        try:
            candidate.relative_to(project_root)
        except ValueError:
            return None
        if not candidate.is_file():
            return None
        return candidate

    @app.post("/api/debug/detect")
    def _detect_upload():
        """Upload 1 ảnh (multipart 'file') → JSON boxes + ảnh base64 có vẽ bbox."""
        if "file" not in request.files:
            return jsonify({"ok": False, "error": "missing file field"}), 400
        file = request.files["file"]
        data = file.read()
        if not data:
            return jsonify({"ok": False, "error": "empty file"}), 400
        arr = np.frombuffer(data, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({"ok": False, "error": "cannot decode image"}), 400
        result = detect_with_bbox(frame, _get_detector())
        return jsonify({"ok": True, **result})

    @app.post("/api/debug/detect_base64")
    def _detect_b64():
        """Gửi ảnh qua JSON {'image': 'data:image/jpeg;base64,...'}."""
        body = request.get_json(silent=True) or {}
        b64 = body.get("image", "")
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        try:
            import base64 as _b64
            data = _b64.b64decode(b64)
        except Exception as exc:
            return jsonify({"ok": False, "error": f"base64 decode failed: {exc}"}), 400
        arr = np.frombuffer(data, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({"ok": False, "error": "cannot decode image"}), 400
        result = detect_with_bbox(frame, _get_detector())
        return jsonify({"ok": True, **result})

    @app.get("/api/debug/detect_live/<direction>")
    def _detect_live(direction: str):
        """Lấy frame hiện tại từ camera 'in'/'out', chạy YOLO, trả về bbox + ảnh."""
        if direction not in {"in", "out"}:
            return jsonify({"ok": False, "error": "invalid direction"}), 400
        if orchestrator is None or orchestrator.camera is None:
            return jsonify({"ok": False, "error": "orchestrator not available"}), 400
        frame = orchestrator.camera.get_frame(direction)
        if frame is None:
            return jsonify({"ok": False, "error": "no frame"}), 404
        result = detect_with_bbox(frame, _get_detector())
        return jsonify({"ok": True, "direction": direction, **result})

    # ============================================================
    # YOLO + OCR endpoint (dùng cho staff-desk verify biển số)
    # ============================================================

    @app.post("/api/debug/detect_ocr")
    def _detect_ocr_upload():
        """Upload 1 ảnh → chạy YOLO + OCR từng bbox.

        Body có thể là multipart ``file`` HOẶC JSON ``{image: base64}``.
        Response: {ok, boxes, ocr_results, image, crops, width, height}
        """
        frame = _load_image_from_request()
        if frame is None:
            return jsonify({"ok": False, "error": "missing or invalid image"}), 400
        result = detect_with_bbox_ocr(frame, _get_detector())
        return jsonify({"ok": True, **result})

    @app.post("/api/debug/detect_ocr_by_path")
    def _detect_ocr_by_path():
        """Nhận JSON ``{path: "static/snapshots/xxx.jpg"}`` → YOLO + OCR.

        Dùng khi frontend đã có ``imagePath`` từ SSE camera.ingest và muốn
        gọi lại AI để verify biển số hiện tại.
        """
        body = request.get_json(silent=True) or {}
        image_path = body.get("path", "")
        resolved = _resolve_path(image_path)
        if resolved is None:
            return jsonify({"ok": False, "error": f"invalid or missing path: {image_path}"}), 400
        frame = cv2.imread(str(resolved), cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({"ok": False, "error": "cannot decode image"}), 400
        result = detect_with_bbox_ocr(frame, _get_detector())
        return jsonify({"ok": True, "path": image_path, **result})

    @app.get("/api/debug/detect_ocr_live/<direction>")
    def _detect_ocr_live(direction: str):
        """Lấy frame live từ camera 'in'/'out' → YOLO + OCR."""
        if direction not in {"in", "out"}:
            return jsonify({"ok": False, "error": "invalid direction"}), 400
        if orchestrator is None or orchestrator.camera is None:
            return jsonify({"ok": False, "error": "orchestrator not available"}), 400
        frame = orchestrator.camera.get_frame(direction)
        if frame is None:
            return jsonify({"ok": False, "error": "no frame"}), 404
        result = detect_with_bbox_ocr(frame, _get_detector())
        return jsonify({"ok": True, "direction": direction, **result})

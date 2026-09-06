"""OpenVINO-backed YOLO detector (thay thế PyTorch/Ultralytics để tiết kiệm RAM/CPU).

Định dạng input : OpenVINO IR (XML + BIN) được export từ YOLOv8/YOLOv11.
Định dạng output: tensor (1, 84, N) sau non-max suppression (NMS) thuần NumPy.
Các confidence/IoU thresholds có thể chỉnh qua biến môi trường.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import numpy as np


def _resolve_ir_path(model_path: Path) -> tuple[Path, Path]:
    """Trả về (xml, bin) - tự tìm cùng tên nếu model_path trỏ vào XML hoặc PT."""
    p = Path(model_path)
    if p.suffix == ".pt":
        stem = p.with_suffix("")
        return stem.with_suffix(".xml"), stem.with_suffix(".bin")
    if p.suffix == ".bin":
        return p.with_suffix(".xml"), p
    if p.suffix == ".xml":
        return p, p.with_suffix(".bin")
    return p.with_suffix(".xml"), p.with_suffix(".bin")


class OpenVinoYoloDetector:
    """Detector YOLO chạy thuần OpenVINO runtime + postprocess NMS NumPy."""

    DEFAULT_IMG_SIZE = 640
    DEFAULT_CONF = 0.25
    DEFAULT_IOU = 0.45

    def __init__(self, model_path: Path | str | None = None, device: str | None = None):
        from config import YOLO_MODEL_PATH

        raw_path = Path(model_path) if model_path else Path(YOLO_MODEL_PATH)
        xml_path, bin_path = _resolve_ir_path(raw_path)
        self.model_xml = xml_path
        self.model_bin = bin_path
        self.device = device or os.getenv("OPENVINO_DEVICE", "CPU")
        self.conf_threshold = float(os.getenv("YOLO_CONF_THRESHOLD", self.DEFAULT_CONF))
        self.iou_threshold = float(os.getenv("YOLO_IOU_THRESHOLD", self.DEFAULT_IOU))
        self.img_size = int(os.getenv("YOLO_IMG_SIZE", self.DEFAULT_IMG_SIZE))
        self.num_threads = int(os.getenv("OPENVINO_NUM_THREADS", "2"))

        self.compiled = None
        self.input_name: str | None = None
        self.input_shape = None
        self._last_no_box_log = 0.0
        self._load_model()

    # ------------------------------------------------------------------
    def _load_model(self) -> None:
        if not self.model_xml.exists() or not self.model_bin.exists():
            print(f"[OV-YOLO] IR not found: {self.model_xml} / {self.model_bin}")
            return
        try:
            from openvino.runtime import Core
            core = Core()
            # ép số thread CPU để OpenVINO không chiếm hết cores
            if self.device.upper() == "CPU":
                try:
                    core.set_property("CPU", {"INFERENCE_NUM_THREADS": self.num_threads})
                except Exception:
                    pass
            model = core.read_model(model=self.model_xml)
            self.compiled = core.compile_model(model=model, device_name=self.device)
            self.input_name = self.compiled.input(0).any_name
            shape = self.compiled.input(0).partial_shape
            # Ưu tiên NCHW từ shape, fallback img_size mặc định
            try:
                self.input_shape = (int(shape[2]), int(shape[3]))
            except Exception:
                self.input_shape = (self.img_size, self.img_size)
            print(
                f"[OV-YOLO] Loaded {self.model_xml.name} on {self.device} "
                f"input={self.input_name} shape={self.input_shape} "
                f"conf={self.conf_threshold} iou={self.iou_threshold}"
            )
        except Exception as exc:
            print(f"[OV-YOLO] disabled ({self.model_xml}): {exc}")
            self.compiled = None

    # ------------------------------------------------------------------
    def detect(self, frame) -> list[dict]:
        if self.compiled is None or frame is None:
            return []
        h, w = frame.shape[:2]
        input_h, input_w = self.input_shape

        # Letterbox: resize giữ tỉ lệ, pad 114 (giống YOLO mặc định)
        scale = min(input_w / w, input_h / h)
        new_w = int(round(w * scale))
        new_h = int(round(h * scale))
        # Căn giữa ảnh trong canvas (đúng format YOLO chuẩn).
        pad_w = input_w - new_w
        pad_h = input_h - new_h
        top = pad_h // 2
        left = pad_w // 2
        import cv2
        resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        canvas = np.full((input_h, input_w, 3), 114, dtype=np.uint8)
        canvas[top:top + new_h, left:left + new_w] = resized

        # BGR -> RGB, HWC -> CHW, normalize [0,1]
        rgb = canvas[:, :, ::-1].astype(np.float32) / 255.0
        chw = np.transpose(rgb, (2, 0, 1))[None]  # (1,3,H,W)

        try:
            outputs = self.compiled([chw])
        except Exception as exc:
            print(f"[OV-YOLO] inference error: {exc}")
            return []

        # Output có thể là dict (YOLOv8 export) hoặc tensor. Lấy tensor đầu tiên.
        if isinstance(outputs, dict):
            tensor = next(iter(outputs.values()))
        else:
            tensor = outputs[0]
        tensor = np.asarray(tensor)

        # OpenVINO IR cho YOLOv8 thường trả về (1, 84, N) (4 box + 80 class).
        # Sau khi squeeze batch -> (84, N) rồi (N, 84) để xử lý từng detection.
        if tensor.ndim == 3:
            tensor = tensor[0]
        if tensor.shape[0] in (4, 5, 84) and tensor.ndim == 2:
            tensor = tensor.transpose()
        elif tensor.ndim == 1:
            tensor = tensor.reshape(1, -1)
        # Bây giờ tensor là (N, D). Hỗ trợ cả 2 định dạng:
        #   - (N, 5+1): xywh + obj + classes (YOLOv5/v7)
        #   - (N, 4+nc): xywh + classes (YOLOv8 export no-objectness)
        boxes = self._postprocess(tensor, scale, left, top, input_w, input_h, w, h)
        if not boxes:
            now = time.time()
            if now - self._last_no_box_log >= 5:
                print("[OV-YOLO] no plate box detected")
                self._last_no_box_log = now
        return boxes

    # ------------------------------------------------------------------
    def _postprocess(
        self,
        preds: np.ndarray,
        scale: float,
        left: int,
        top: int,
        input_w: int,
        input_h: int,
        orig_w: int,
        orig_h: int,
    ) -> list[dict]:
        if preds.size == 0:
            return []
        # Lấy confidence & class dựa trên layout
        # Format A: (N, 5 + nc)  -> [x, y, w, h, obj, cls...]
        # Format B: (N, 4 + nc)  -> [x, y, w, h, cls...]
        n_cols = preds.shape[1]
        if n_cols >= 6:
            obj = preds[:, 4]
            cls_scores = preds[:, 5:]
            cls_ids = np.argmax(cls_scores, axis=1)
            cls_conf = cls_scores[np.arange(cls_scores.shape[0]), cls_ids]
            conf = obj * cls_conf
        elif n_cols == 5:
            obj = preds[:, 4]
            conf = obj
            cls_ids = np.zeros_like(obj, dtype=np.int64)
        else:
            # Không đúng định dạng - bỏ qua
            return []

        mask = conf >= self.conf_threshold
        if not np.any(mask):
            return []
        preds = preds[mask]
        conf = conf[mask]
        cls_ids = cls_ids[mask]

        xywh = preds[:, :4]
        # xywh tính theo pixel trên input grid -> đổi về pixel ảnh gốc.
        # Quan trọng: cộng pad (đã đặt ở top/left khi letterbox).
        xywh[:, 0] = (xywh[:, 0] - left) / scale
        xywh[:, 1] = (xywh[:, 1] - top) / scale
        xywh[:, 2] = xywh[:, 2] / scale
        xywh[:, 3] = xywh[:, 3] / scale

        x1 = xywh[:, 0] - xywh[:, 2] / 2
        y1 = xywh[:, 1] - xywh[:, 3] / 2
        x2 = xywh[:, 0] + xywh[:, 2] / 2
        y2 = xywh[:, 1] + xywh[:, 3] / 2
        x1 = np.clip(x1, 0, orig_w - 1)
        y1 = np.clip(y1, 0, orig_h - 1)
        x2 = np.clip(x2, 0, orig_w - 1)
        y2 = np.clip(y2, 0, orig_h - 1)

        boxes_for_nms = np.stack([x1, y1, x2, y2, conf], axis=1).tolist()
        keep = self._nms(boxes_for_nms, self.iou_threshold)

        results: list[dict] = []
        for idx in keep:
            bx = boxes_for_nms[idx]
            results.append({
                "x1": int(round(bx[0])),
                "y1": int(round(bx[1])),
                "x2": int(round(bx[2])),
                "y2": int(round(bx[3])),
                "confidence": float(bx[4]),
                "class_id": int(cls_ids[idx]),
            })
        return results

    @staticmethod
    def _nms(boxes: list[list[float]], iou_thr: float) -> list[int]:
        if not boxes:
            return []
        arr = np.asarray(boxes, dtype=np.float32)
        x1, y1, x2, y2, scores = arr[:, 0], arr[:, 1], arr[:, 2], arr[:, 3], arr[:, 4]
        areas = (x2 - x1) * (y2 - y1)
        order = scores.argsort()[::-1]
        keep: list[int] = []
        while order.size > 0:
            i = int(order[0])
            keep.append(i)
            if order.size == 1:
                break
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])
            inter = np.maximum(0.0, xx2 - xx1) * np.maximum(0.0, yy2 - yy1)
            iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-9)
            inds = np.where(iou <= iou_thr)[0]
            order = order[inds + 1]
        return keep

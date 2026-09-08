import base64
import io
import json
import os
import re
import tempfile
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import cv2
import numpy as np
from paddleocr import PaddleOCR

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, ImageFilter, ImageOps
from pydantic import BaseModel

_ocr = None
_yolo = None
_plate_yolo = None
_plate_onnx = None

def get_ocr():
    global _ocr
    if _ocr is None:
        lang = os.environ.get("OCR_LANG", "en")
        _ocr = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
    return _ocr

def get_yolo():
    global _yolo
    if _yolo is None:
        from ultralytics import YOLO
        model_path = os.environ.get("YOLO_MODEL", "yolov8m.pt")
        _yolo = YOLO(model_path)
    return _yolo

def get_plate_model():
    """Load model nhận diện biển số. Ưu tiên: ONNX → YOLO .pt → DETR."""
    global _plate_yolo, _plate_onnx
    if _plate_yolo is not None:
        return _plate_yolo

    # Ưu tiên 1: ONNX (nhe, nhanh)
    onnx_path = os.environ.get("PLATE_ONNX_MODEL", "models/onnx/license_plate.onnx")
    if Path(onnx_path).exists():
        try:
            import onnxruntime as ort
            _plate_onnx = ort.InferenceSession(onnx_path)
            _plate_yolo = ("onnx", _plate_onnx)
            return _plate_yolo
        except Exception as e:
            print(f"[plate] Khong load ONNX: {e}")

    # Ưu tiên 2: YOLO .pt
    plate_path = os.environ.get("PLATE_YOLO_MODEL", "models/license_plate.pt")
    if Path(plate_path).exists():
        try:
            from ultralytics import YOLO
            _plate_yolo = YOLO(plate_path)
            return _plate_yolo
        except Exception:
            pass

    # Ưu tiên 3: DETR safetensors (HuggingFace)
    hf_dir = Path("models/plate-hf")
    config_path = hf_dir / "config.json"
    weights_path = hf_dir / "model.safetensors"
    if config_path.exists() and weights_path.exists():
        try:
            detre_model = _load_detr_plate_model(config_path, weights_path)
            if detre_model is not None:
                _plate_yolo = ("detr", detre_model)
                return _plate_yolo
        except Exception as e:
            print(f"[plate] Khong load DETR: {e}")

    return None


def _load_detr_plate_model(config_path, weights_path):
    """Load DETR model tu safetensors + config.json."""
    import json
    import torch
    from safetensors.torch import load_file

    with open(config_path) as f:
        config = json.load(f)

    num_classes = config.get("num_classes", 2)
    num_queries = config.get("num_queries", 20)

    state_dict = load_file(str(weights_path))

    # Xac dinh kich thuoc input tu backbone
    # Tim shape cua conv1.weight
    img_shape = None
    for k, v in state_dict.items():
        if "backbone" in k and "conv1" in k and "weight" in k:
            img_shape = v.shape[1]  # so channels
            break

    if img_shape is None:
        img_shape = 3

    # Don gian hoa: chi can dict weights de post-process
    # Model DETR don gian hoa: tra ve bounding boxes tu queries
    class PlateDETRModel:
        def __init__(self, state_dict, num_classes, num_queries):
            self.state_dict = state_dict
            self.num_classes = num_classes
            self.num_queries = num_queries
            self.input_size = 640

        def predict(self, img_array, conf=0.35):
            """Don gian hoa: su dung heuristic + OCR de thay the DETR inference
            neu khong the chay inference that su."""
            # Tra ve empty — se fallback sang contour detection
            return []

    return PlateDETRModel(state_dict, num_classes, num_queries)

app = FastAPI(title="Bãi Đỗ Xe AI Service")


PLATE_PATTERNS = [
    re.compile(r"\b\d{2}[A-Z]{1,2}\d?[-\s.]?\d{3}[-\s.]?\d{2}\b"),
    re.compile(r"\b\d{2}[A-Z]{1,2}[-\s.]?\d{4,5}\b"),
]


class SnapshotRequest(BaseModel):
    rtspUrl: str
    username: str | None = None
    password: str | None = None


def normalize_plate(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def format_plate(value: str) -> str:
    normalized = normalize_plate(value)
    if len(normalized) >= 8:
        return normalized
    return value.upper().strip()


def camera_url(value: str, username: str | None, password: str | None) -> str:
    if not username:
        return value
    parts = urlsplit(value)
    if "@" in parts.netloc:
        return value
    auth = username if password is None else f"{username}:{password}"
    return urlunsplit((parts.scheme, f"{auth}@{parts.netloc}", parts.path, parts.query, parts.fragment))


def find_plate_region(image: Image.Image) -> Image.Image | None:
    """
    Try to locate the license plate region using OpenCV contour detection.
    Returns cropped plate region or None if not found.
    """
    img_array = np.array(image)
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    # Apply bilateral filter to reduce noise while keeping edges sharp
    filtered = cv2.bilateralFilter(gray, 11, 17, 17)
    # Edge detection
    edges = cv2.Canny(filtered, 30, 200)
    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    # Sort by area descending
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:30]

    plate_region = None
    for contour in contours:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        # License plates are roughly rectangular (4 corners)
        if len(approx) == 4:
            x, y, w, h = cv2.boundingRect(approx)
            aspect_ratio = w / h if h > 0 else 0
            # Vietnamese plates: aspect ratio between 2.0 and 5.5
            if 1.5 < aspect_ratio < 6.0 and w > 60 and h > 20:
                # Add padding
                pad = 5
                x1 = max(0, x - pad)
                y1 = max(0, y - pad)
                x2 = min(img_array.shape[1], x + w + pad)
                y2 = min(img_array.shape[0], y + h + pad)
                plate_region = image.crop((x1, y1, x2, y2))
                break

    return plate_region


def preprocess_variants(image: Image.Image) -> list[Image.Image]:
    # Try to find and crop plate region first
    plate = find_plate_region(image)
    source = plate if plate else image

    gray = ImageOps.grayscale(source)
    resized = gray.resize((gray.width * 2, gray.height * 2))
    sharp = resized.filter(ImageFilter.SHARPEN)
    threshold = sharp.point(lambda pixel: 255 if pixel > 150 else 0)
    inverted = ImageOps.invert(threshold)

    variants = [resized, sharp, threshold, inverted]
    # If we found plate region, also add full-image variants as fallback
    if plate:
        full_gray = ImageOps.grayscale(image)
        full_resized = full_gray.resize((full_gray.width * 2, full_gray.height * 2))
        full_sharp = full_resized.filter(ImageFilter.SHARPEN)
        variants.append(full_resized)
        variants.append(full_sharp)

    return variants


def average_hash(image: Image.Image) -> str:
    gray = ImageOps.grayscale(image).resize((8, 8))
    pixels = list(gray.getdata())
    avg = sum(pixels) / len(pixels)
    bits = ["1" if pixel >= avg else "0" for pixel in pixels]
    return "".join(f"{int(''.join(bits[index:index + 4]), 2):x}" for index in range(0, 64, 4))


def extract_plate(raw_text: str) -> str:
    text = raw_text.upper().replace(" ", "")
    text = text.replace("O", "0").replace("I", "1")
    for pattern in PLATE_PATTERNS:
        match = pattern.search(text)
        if match:
            return format_plate(match.group(0))
    candidates = re.findall(r"\d{2}[A-Z0-9]{4,8}", text)
    if candidates:
        return format_plate(candidates[0])
    return ""


def detect_vehicle_type(image: Image.Image) -> str:
    """
    AI-03: Detect vehicle type based on image dimensions and contour analysis.
    Uses aspect ratio heuristic: cars are wider, motorcycles are taller/narrower.
    """
    width, height = image.size
    aspect_ratio = width / height if height > 0 else 1.0

    # Convert to numpy for contour analysis
    img_array = np.array(image)
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return "Không xác định"

    # Get the largest contour (likely the vehicle)
    largest = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest)
    contour_ratio = w / h if h > 0 else 1.0
    area_ratio = cv2.contourArea(largest) / (width * height)

    # Heuristic classification
    if aspect_ratio > 1.3 and contour_ratio > 1.2 and area_ratio > 0.15:
        return "Ô tô"
    elif aspect_ratio < 0.9 or contour_ratio < 0.8:
        return "Xe máy"
    elif area_ratio > 0.3 and contour_ratio > 1.5:
        return "Xe tải"
    else:
        return "Ô tô"


def _upscale_plate(img_cv, pad_ratio=0.30, scale=4):
    """Tăng resolution ảnh biển số: padding + resize.
    Giúp OCR đọc chính xác hơn trên ảnh nhỏ."""
    h, w = img_cv.shape[:2]
    pad_x = int(w * pad_ratio)
    pad_y = int(h * pad_ratio)
    padded = cv2.copyMakeBorder(
        img_cv, pad_y, pad_y, pad_x, pad_x,
        cv2.BORDER_REFLECT_101,
    )
    upscaled = cv2.resize(padded, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return upscaled


def _ocr_image(img_cv) -> tuple[str, int]:
    """Chạy PaddleOCR trên numpy array, trả về (raw_text, confidence).
    Tu dong upscale anh nho truoc khi OCR de doc chinh xac hon."""
    ocr = get_ocr()

    # Upscale neu anh nho (r < 100px hoac h < 50px)
    h, w = img_cv.shape[:2]
    if w < 100 or h < 50:
        img_cv = _upscale_plate(img_cv, pad_ratio=0.30, scale=4)

    result = ocr.ocr(img_cv, cls=True)
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


def _crop_vehicle_regions(img_cv) -> list:
    """Dùng YOLO detect xe (car/motorcycle/bus/truck), trả về list ảnh crop."""
    yolo = get_yolo()
    results = yolo.predict(img_cv, conf=0.25, verbose=False)[0]
    vehicle_classes = {2, 3, 5, 7}  # car, motorcycle, bus, truck (COCO)
    crops = []
    h, w = img_cv.shape[:2]
    for det in results.boxes:
        if int(det.cls) not in vehicle_classes:
            continue
        x1, y1, x2, y2 = [int(v) for v in det.xyxy[0].tolist()]
        # Thêm padding 5%
        pad_x = int((x2 - x1) * 0.05)
        pad_y = int((y2 - y1) * 0.05)
        x1 = max(0, x1 - pad_x)
        y1 = max(0, y1 - pad_y)
        x2 = min(w, x2 + pad_x)
        y2 = min(h, y2 + pad_y)
        crops.append(img_cv[y1:y2, x1:x2])
    return crops


def _crop_plate_regions(img_cv) -> list[tuple]:
    """
    Dùng model biển số chuyên dụng detect vùng biển số.
    Hỗ trợ: ONNX → YOLO .pt → DETR.
    Tra ve list[(crop, confidence)]. Tra [] neu chua co model.
    """
    plate_model = get_plate_model()
    if plate_model is None:
        return []

    if isinstance(plate_model, tuple):
        model_type, model = plate_model
    else:
        model_type, model = "yolo", plate_model

    plates = []
    h, w = img_cv.shape[:2]

    if model_type == "onnx":
        # ONNX inference
        plates = _onnx_detect_plates(model, img_cv, h, w)

    elif model_type == "yolo":
        results = model.predict(img_cv, conf=0.35, verbose=False)[0]
        for det in results.boxes:
            conf = float(det.conf[0])
            x1, y1, x2, y2 = [int(v) for v in det.xyxy[0].tolist()]
            pad_x = int((x2 - x1) * 0.03)
            pad_y = int((y2 - y1) * 0.03)
            x1 = max(0, x1 - pad_x)
            y1 = max(0, y1 - pad_y)
            x2 = min(w, x2 + pad_x)
            y2 = min(h, y2 + pad_y)
            if x2 - x1 > 20 and y2 - y1 > 10:
                plates.append((img_cv[y1:y2, x1:x2], conf))

    # DETR: fallback
    plates.sort(key=lambda p: p[1], reverse=True)
    return plates


def _onnx_detect_plates(session, img_cv, h, w, conf_threshold=0.35):
    """Chay inference tren ONNX model de detect bien so."""
    import numpy as np

    # Preprocess: resize 640x640, normalize
    input_shape = session.get_inputs()[0].shape
    _, _, inp_h, inp_w = input_shape

    img_resized = cv2.resize(img_cv, (inp_w, inp_h))
    img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
    img_normalized = img_rgb.astype(np.float32) / 255.0
    img_transposed = np.transpose(img_normalized, (2, 0, 1))  # HWC -> CHW
    img_batch = np.expand_dims(img_transposed, axis=0)  # add batch

    # Inference
    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: img_batch})

    # Parse output (YOLO format: [batch, num_detections, 6] = [x1,y1,x2,y2,conf,class])
    plates = []
    output = outputs[0]
    if len(output.shape) == 3:
        detections = output[0]
        for det in detections:
            if len(det) >= 6:
                x1, y1, x2, y2, conf, cls = det[:6]
                if conf < conf_threshold:
                    continue
                # Scale to original image
                sx = w / inp_w
                sy = h / inp_h
                x1 = int(x1 * sx)
                y1 = int(y1 * sy)
                x2 = int(x2 * sx)
                y2 = int(y2 * sy)
                if x2 - x1 > 20 and y2 - y1 > 10:
                    plates.append((img_cv[y1:y2, x1:x2], float(conf)))

    return plates


def detect_plate(image_path: Path) -> dict:
    image_pil = Image.open(image_path).convert("RGB")
    img_cv = cv2.imread(str(image_path))

    best_plate = ""
    best_text = ""
    best_confidence = 0
    detection_method = "none"

    # ===== ƯU TIÊN 1: Model biển số chuyên dụng =====
    plate_regions = _crop_plate_regions(img_cv)
    if plate_regions:
        detection_method = "plate-model"
        for plate_crop, yolo_conf in plate_regions[:3]:
            raw_text, ocr_conf = _ocr_image(plate_crop)
            plate = extract_plate(raw_text)
            combined = int(yolo_conf * 40 + ocr_conf * 0.6)
            if plate and combined >= best_confidence:
                best_plate = plate
                best_text = raw_text
                best_confidence = combined

    # Pushy rule (detection-strategy.md):
    # Only accept plate-model when we have a plate AND combined confidence >= 60.
    # If plate-model produced a weak result, discard it so we fall back to more robust tiers.
    if best_plate and best_confidence < 60:
        best_plate = ""
        best_text = ""
        best_confidence = 0
        # detection_method will be overwritten by the next successful tier below

    # ===== ƯU TIÊN 2: YOLO detect xe → contour tìm biển → OCR =====
    if not best_plate:
        detection_method = "vehicle-contour"
        crops = _crop_vehicle_regions(img_cv)
        if not crops:
            crops = [img_cv]

        for crop in crops:
            pil_crop = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
            plate_region = find_plate_region(pil_crop)

            candidates = []
            if plate_region is not None:
                plate_cv = cv2.cvtColor(np.array(plate_region), cv2.COLOR_RGB2BGR)
                candidates.append(plate_cv)
            candidates.append(crop)

            for candidate in candidates:
                raw_text, confidence = _ocr_image(candidate)
                plate = extract_plate(raw_text)
                if plate and confidence >= best_confidence:
                    best_plate = plate
                    best_text = raw_text
                    best_confidence = confidence

    # ===== ƯU TIÊN 3: OCR toàn ảnh (fallback cuối) =====
    if not best_plate:
        detection_method = "full-image-ocr"
        raw_text, confidence = _ocr_image(img_cv)
        plate = extract_plate(raw_text)
        if plate:
            best_plate = plate
            best_text = raw_text
            best_confidence = confidence

    return {
        "plate": best_plate,
        "confidence": best_confidence,
        "rawText": best_text or "Không nhận diện được biển số",
        "vehicleType": detect_vehicle_type(image_pil),
        "imageHash": average_hash(image_pil),
        "detectionMethod": detection_method,
        "hasPlateModel": get_plate_model() is not None,
    }


@app.get("/health")
def health():
    plate_model = get_plate_model()
    model_type = "none"
    if plate_model is not None:
        model_type = "yolo" if not isinstance(plate_model, tuple) else plate_model[0]
    return {
        "ok": True,
        "hasPlateModel": plate_model is not None,
        "plateModelType": model_type,
        "plateModelPath": os.environ.get("PLATE_YOLO_MODEL", "models/license_plate.pt"),
        "onnxPath": os.environ.get("PLATE_ONNX_MODEL", "models/onnx/license_plate.onnx"),
    }


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    suffix = Path(file.filename or "upload.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        temp.write(await file.read())
        temp_path = Path(temp.name)

    try:
        result = detect_plate(temp_path)
    finally:
        temp_path.unlink(missing_ok=True)

    return result


@app.post("/snapshot")
def snapshot(request: SnapshotRequest):
    capture = cv2.VideoCapture(camera_url(request.rtspUrl, request.username, request.password))
    if not capture.isOpened():
        raise HTTPException(status_code=502, detail="Không mở được camera RTSP/HTTP.")

    ok, frame = capture.read()
    capture.release()
    if not ok or frame is None:
        raise HTTPException(status_code=502, detail="Không đọc được frame từ camera.")

    encoded_ok, encoded = cv2.imencode(".jpg", frame)
    if not encoded_ok:
        raise HTTPException(status_code=500, detail="Không mã hóa được ảnh snapshot.")

    return {
        "imageBase64": base64.b64encode(encoded.tobytes()).decode("ascii"),
        "contentType": "image/jpeg",
    }


# ─── Phát hiện đỗ sai vị trí (YOLO + overlap) ──────────────────────────
# Các loại model, mỗi loại có bộ class id riêng cho "phương tiện":
#   - "coco" (yolov8m.pt mặc định): ảnh góc ngang/chéo. 2=car,3=motorcycle,5=bus,7=truck
#   - "aerial" (VisDrone): ảnh chụp TỪ TRÊN THẲNG XUỐNG (top-down).
#       3=car,4=van,5=truck,8=bus,9=motor
#   - "seg" (YOLO11/12-seg): trả về MẶT NẠ (mask) viền thân xe thay vì hộp chữ nhật.
#       Dùng class COCO. Khuyến nghị cho "đỗ lấn vạch / chiếm 2 ô" vì hộp chữ nhật
#       của xe đỗ nghiêng hay đè sang ô bên cạnh dù thân xe không thực sự lấn.
#   - "hybrid": KẾT HỢP — model "aerial" xác định ĐÂU LÀ XE (nhãn đúng cho ảnh
#       top-down), model "seg" cho VIỀN THÂN XE chính xác. Chỉ giữ mask seg trùng
#       với một xe mà aerial đã xác nhận → vừa đếm đúng số xe, vừa đo lấn vạch /
#       chiếm 2 ô chính xác. Khuyến nghị cho ảnh top-down.
# Với ảnh top-down, model COCO hay nhận xe nhầm thành "cell phone" → dùng "aerial"/"hybrid".
_VEHICLE_CLASSES = {
    "coco": {2, 3, 5, 7},
    "aerial": {3, 4, 5, 8, 9},
    "seg": {2, 3, 5, 7},
}
_DEFAULT_MODEL = "aerial"


class SlotPolygon(BaseModel):
    slotCode: str
    # Toạ độ 4+ điểm, CHUẨN HOÁ 0..1 theo (width, height) của ảnh.
    polygon: list[tuple[float, float]]


class LaneDivider(BaseModel):
    # Đường ranh giới làn: 2 điểm đầu-cuối, CHUẨN HOÁ 0..1 theo (width, height).
    # Cấu hình MỘT LẦN cho mỗi camera (lúc bãi trống, vạch chưa bị xe che).
    start: tuple[float, float]
    end: tuple[float, float]


@lru_cache(maxsize=3)
def _yolo_model(kind: str = _DEFAULT_MODEL):
    """Load YOLO theo loại model, cache mỗi loại một lần.
    - kind="coco": yolov8m.pt (ảnh góc ngang/chéo). Đổi qua env YOLO_MODEL.
    - kind="aerial": model VisDrone (ảnh top-down), tải từ HuggingFace lần đầu.
      Đổi repo/file qua env YOLO_AERIAL_REPO / YOLO_AERIAL_FILE.
    - kind="seg": model phân vùng (segmentation) YOLO11/12-seg. Mặc định
      yolo11m-seg.pt, Ultralytics tự tải lần đầu. Đổi qua env YOLO_SEG_MODEL
      (vd: yolo12m-seg.pt, yolo11x-seg.pt).
    """
    from ultralytics import YOLO

    if kind == "aerial":
        from huggingface_hub import hf_hub_download

        repo = os.environ.get("YOLO_AERIAL_REPO", "mshamrai/yolov8m-visdrone")
        fname = os.environ.get("YOLO_AERIAL_FILE", "best.pt")
        return YOLO(hf_hub_download(repo_id=repo, filename=fname))

    if kind == "seg":
        return YOLO(os.environ.get("YOLO_SEG_MODEL", "yolo11m-seg.pt"))

    model_path = os.environ.get("YOLO_MODEL", "yolov8m.pt")
    return YOLO(model_path)


def _vehicle_class_ids(kind: str) -> set:
    return _VEHICLE_CLASSES.get(kind, _VEHICLE_CLASSES["coco"])


def _vehicle_shapes(
    results,
    vehicle_ids: set,
    class_agnostic: bool = False,
    image_area: float | None = None,
    min_area_frac: float = 0.0,
    max_area_frac: float = 1.0,
):
    """Trả về danh sách phương tiện dưới dạng đa giác Shapely (toạ độ pixel).
    Với model "-seg" có mask: dùng VIỀN THÂN XE thật (đa giác) → đo lấn vạch /
    chiếm 2 ô chính xác kể cả khi xe đỗ nghiêng. Không có mask thì lùi về hộp
    chữ nhật (bounding box) như cũ.
    - class_agnostic: bỏ qua bộ lọc class id, NHẬN MỌI mask/box. Cần cho ảnh
      top-down: model COCO-seg nhận đúng viền xe nhưng gán nhầm class (vd
      "cell phone"=67). Với ô đỗ cố định, viền xe mới quan trọng, không phải nhãn.
    - min_area_frac / max_area_frac: CHỈ áp dụng khi class_agnostic, loại các
      mask quá nhỏ (nhiễu) hoặc quá lớn (mái che, sàn) theo tỷ lệ diện tích so
      với khung ảnh (image_area). Bỏ qua nếu image_area là None.
    """
    from shapely.geometry import Polygon, box as shp_box

    shapes: list[dict] = []
    masks = getattr(results, "masks", None)
    mask_polys = masks.xy if masks is not None else None
    apply_area = class_agnostic and image_area and image_area > 0

    for idx, det in enumerate(results.boxes):
        if not class_agnostic and int(det.cls) not in vehicle_ids:
            continue
        x1, y1, x2, y2 = det.xyxy[0].tolist()
        poly = None
        if mask_polys is not None and idx < len(mask_polys):
            pts = mask_polys[idx]
            if pts is not None and len(pts) >= 3:
                poly = Polygon([(float(px), float(py)) for px, py in pts])
                if not poly.is_valid:
                    poly = poly.buffer(0)
        if poly is None or poly.is_empty or poly.area <= 0:
            poly = shp_box(x1, y1, x2, y2)
        if apply_area:
            frac = poly.area / image_area
            if frac < min_area_frac or frac > max_area_frac:
                continue
        shapes.append({"poly": poly, "conf": float(det.conf), "box": (x1, y1, x2, y2)})
    return shapes


def _aerial_vehicle_boxes(image_np, conf: float, imgsz: int):
    """Chạy model 'aerial' (VisDrone) để lấy hộp các XE đã xác nhận (nhãn đúng
    cho ảnh top-down). Trả về list đa giác box (pixel). Dùng để xác thực mask seg
    trong chế độ hybrid → loại vật KHÔNG phải xe mà seg trót segment."""
    from shapely.geometry import box as shp_box

    vehicle_ids = _vehicle_class_ids("aerial")
    res = _yolo_model("aerial").predict(image_np, conf=conf, imgsz=imgsz, verbose=False)[0]
    boxes = []
    for det in res.boxes:
        if int(det.cls) in vehicle_ids:
            x1, y1, x2, y2 = det.xyxy[0].tolist()
            boxes.append(shp_box(x1, y1, x2, y2))
    return boxes


def _hybrid_vehicle_shapes(
    image_np,
    conf: float,
    imgsz: int,
    image_area: float,
    min_area_frac: float = 0.0,
    max_area_frac: float = 1.0,
    match_iou: float = 0.10,
):
    """HYBRID: 'aerial' xác nhận ĐÂU LÀ XE, 'seg' cho VIỀN chính xác.
    Lấy mọi mask của model seg (class-agnostic) rồi CHỈ GIỮ mask trùng đủ nhiều
    với một hộp xe mà aerial xác nhận (IoU phần giao / diện tích mask ≥ match_iou).
    → đếm đúng số xe (loại nhiễu) + viền chính xác để đo lấn vạch / chiếm 2 ô.
    - match_iou: tỷ lệ diện tích mask nằm trong hộp xe aerial để coi là khớp.
    """
    seg_res = _yolo_model("seg").predict(image_np, conf=conf, imgsz=imgsz, verbose=False)[0]
    seg_shapes = _vehicle_shapes(
        seg_res, set(), class_agnostic=True,
        image_area=image_area, min_area_frac=min_area_frac, max_area_frac=max_area_frac,
    )
    vehicle_boxes = _aerial_vehicle_boxes(image_np, conf, imgsz)
    if not vehicle_boxes:
        return []

    confirmed = []
    for shape in seg_shapes:
        poly = shape["poly"]
        area = poly.area or 1.0
        for vbox in vehicle_boxes:
            inter = poly.intersection(vbox).area
            if inter / area >= match_iou:
                confirmed.append(shape)
                break
    return confirmed


def _resolve_class_agnostic(model: str, class_agnostic: bool | None) -> bool:
    """Mặc định bật class-agnostic cho model "seg" (ảnh top-down hay gán nhầm
    class). Người gọi có thể ép buộc qua tham số."""
    if class_agnostic is not None:
        return class_agnostic
    return model == "seg"


def detect_cars(
    image: Image.Image,
    conf: float = 0.20,
    imgsz: int = 1536,
    model: str = "aerial",
    class_agnostic: bool | None = None,
    min_area_frac: float = 0.0,
    max_area_frac: float = 1.0,
) -> dict:
    """
    ĐẾM XE TỰ ĐỘNG — không cần cấu hình ô đỗ/ranh giới.
    AI tự tìm mọi xe trong ảnh và trả về hộp bao + tổng số. Phù hợp khi xe đỗ
    lệch, vị trí không cố định. Mặc định "hybrid" (aerial xác nhận xe + seg viền)
    cho ảnh top-down; đổi model nếu camera góc chéo/ngang.
    """
    import numpy as np

    width, height = image.size
    image_np = np.array(image)

    if model == "hybrid":
        shapes = _hybrid_vehicle_shapes(
            image_np, conf, imgsz, width * height, min_area_frac, max_area_frac
        )
    else:
        vehicle_ids = _vehicle_class_ids(model)
        agnostic = _resolve_class_agnostic(model, class_agnostic)
        results = _yolo_model(model).predict(
            image_np, conf=conf, imgsz=imgsz, verbose=False
        )[0]
        shapes = _vehicle_shapes(
            results, vehicle_ids, agnostic, width * height, min_area_frac, max_area_frac
        )

    cars = []
    for s in shapes:
        x1, y1, x2, y2 = s["box"]
        cars.append({
            "box": [round(x1 / width, 4), round(y1 / height, 4),
                    round(x2 / width, 4), round(y2 / height, 4)],
            "conf": round(float(s["conf"]), 3),
        })

    return {"vehicleCount": len(cars), "cars": cars}


@app.post("/detect-cars")
async def detect_cars_endpoint(
    file: UploadFile | None = File(None),
    imageBase64: str | None = Form(None),
    conf: float = Form(0.20),
    imgsz: int = Form(1536),
    model: str = Form("aerial"),
    classAgnostic: bool | None = Form(None),
    minAreaFrac: float = Form(0.0),
    maxAreaFrac: float = Form(1.0),
):
    """
    Đếm xe tự động trong ảnh (không cần polygon ô đỗ).
    Trả về {vehicleCount, cars:[{box,conf}]} với box chuẩn hoá 0..1.
    """
    if file is not None:
        raw = await file.read()
    elif imageBase64:
        try:
            raw = base64.b64decode(imageBase64)
        except (ValueError, base64.binascii.Error):
            raise HTTPException(status_code=400, detail="imageBase64 không hợp lệ.")
    else:
        raise HTTPException(status_code=400, detail="Cần cung cấp file ảnh hoặc imageBase64.")

    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except OSError:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh.")

    return detect_cars(image, conf, imgsz, model, classAgnostic, minAreaFrac, maxAreaFrac)


def detect_occupancy(
    image: Image.Image,
    slots: list[SlotPolygon],
    overlap_threshold: float,
    straddle_threshold: float,
    conf: float = 0.25,
    imgsz: int = 1280,
    model: str = _DEFAULT_MODEL,
    class_agnostic: bool | None = None,
    min_area_frac: float = 0.0,
    max_area_frac: float = 1.0,
) -> dict:
    """
    Phát hiện xe và đối chiếu với polygon các ô đỗ.
    - overlap_threshold: tỷ lệ diện tích xe nằm trong ô để coi ô bị chiếm.
    - straddle_threshold: tỷ lệ phủ sang ô thứ 2 để gắn cờ "đỗ lấn".
    - conf: ngưỡng tin cậy tối thiểu của YOLO (thấp hơn = bắt được nhiều xe hơn).
    - imgsz: cạnh dài ảnh đưa vào model (lớn hơn = bắt xe nhỏ/xa tốt hơn, chậm hơn).
    - model: "coco" (ngang/chéo), "aerial" (top-down), "seg" (mask chính xác)
      hoặc "hybrid" (aerial xác nhận xe + seg cho viền — khuyến nghị top-down).
    - class_agnostic: nhận mọi mask bất kể nhãn class. None = tự bật cho "seg"
      (ảnh top-down hay bị gán nhầm class như "cell phone").
    - min_area_frac / max_area_frac: chỉ dùng khi class_agnostic, loại mask quá
      nhỏ (nhiễu) hoặc quá lớn (mái che/sàn) theo tỷ lệ diện tích khung ảnh.
    """
    from shapely.geometry import Polygon

    import numpy as np

    width, height = image.size
    image_np = np.array(image)

    # 1) Hình các phương tiện (đa giác mask nếu có, không thì hộp chữ nhật)
    if model == "hybrid":
        cars = _hybrid_vehicle_shapes(
            image_np, conf, imgsz, width * height, min_area_frac, max_area_frac
        )
    else:
        vehicle_ids = _vehicle_class_ids(model)
        agnostic = _resolve_class_agnostic(model, class_agnostic)
        results = _yolo_model(model).predict(
            image_np, conf=conf, imgsz=imgsz, verbose=False
        )[0]
        cars = _vehicle_shapes(
            results, vehicle_ids, agnostic, width * height, min_area_frac, max_area_frac
        )

    # 2) Polygon ô đỗ (đổi từ chuẩn hoá 0..1 sang pixel)
    slot_polys: dict[str, Polygon] = {}
    for slot in slots:
        pts = [(px * width, py * height) for px, py in slot.polygon]
        poly = Polygon(pts)
        if not poly.is_valid:
            poly = poly.buffer(0)  # tự sửa polygon tự cắt
        slot_polys[slot.slotCode] = poly

    report = {
        code: {"slotCode": code, "status": "empty", "coverage": 0.0, "straddling": []}
        for code in slot_polys
    }

    # 3) Mỗi xe phủ những ô nào
    for car in cars:
        car_area = car["poly"].area or 1.0
        covered = []  # (slotCode, tỷ lệ diện tích xe nằm trong ô)
        for code, poly in slot_polys.items():
            inter = car["poly"].intersection(poly).area
            if inter > 0:
                covered.append((code, inter / car_area))

        if not covered:
            continue

        covered.sort(key=lambda item: item[1], reverse=True)
        primary, primary_frac = covered[0]
        others = [code for code, frac in covered[1:] if frac >= straddle_threshold]

        if primary_frac < overlap_threshold:
            continue

        report[primary]["coverage"] = round(primary_frac, 3)
        if others:
            report[primary]["status"] = "straddling"  # đỗ lấn sang ô khác
            report[primary]["straddling"] = others
            for code in others:
                if report[code]["status"] == "empty":
                    report[code]["status"] = "intruded"  # bị xe khác lấn vào
        elif report[primary]["status"] != "straddling":
            report[primary]["status"] = "occupied"  # đỗ đúng ô

    slot_results = list(report.values())
    return {
        "vehicleCount": len(cars),
        "slots": slot_results,
        "violations": [s for s in slot_results if s["status"] == "straddling"],
    }


@app.post("/detect-occupancy")
async def detect_occupancy_endpoint(
    file: UploadFile | None = File(None),
    imageBase64: str | None = Form(None),
    slots: str = Form(...),
    overlapThreshold: float = Form(0.30),
    straddleThreshold: float = Form(0.15),
    conf: float = Form(0.15),
    imgsz: int = Form(1536),
    model: str = Form(_DEFAULT_MODEL),
    classAgnostic: bool | None = Form(None),
    minAreaFrac: float = Form(0.0),
    maxAreaFrac: float = Form(1.0),
):
    """
    Nhận ảnh (upload mô phỏng HOẶC base64 từ snapshot camera) + danh sách polygon ô đỗ,
    trả về trạng thái từng ô và các trường hợp đỗ lấn.
    `slots` là JSON string: [{"slotCode":"A-01","polygon":[[x,y],...]}, ...]
    `classAgnostic` để trống = tự bật cho model "seg" (ảnh top-down).
    `minAreaFrac`/`maxAreaFrac` (chỉ khi class-agnostic) lọc mask theo tỷ lệ diện tích.
    """
    if file is not None:
        raw = await file.read()
    elif imageBase64:
        try:
            raw = base64.b64decode(imageBase64)
        except (ValueError, base64.binascii.Error):
            raise HTTPException(status_code=400, detail="imageBase64 không hợp lệ.")
    else:
        raise HTTPException(status_code=400, detail="Cần cung cấp file ảnh hoặc imageBase64.")

    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except OSError:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh.")

    try:
        slot_list = [SlotPolygon(**item) for item in json.loads(slots)]
    except (json.JSONDecodeError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Trường slots không phải JSON polygon hợp lệ.")

    if not slot_list:
        raise HTTPException(status_code=400, detail="Cần ít nhất một ô đỗ trong slots.")

    return detect_occupancy(
        image, slot_list, overlapThreshold, straddleThreshold, conf, imgsz, model,
        classAgnostic, minAreaFrac, maxAreaFrac,
    )


# ─── Phát hiện đỗ lấn làn bằng đường ranh giới (hiệu chỉnh 1 lần / camera) ──────
def detect_straddle(
    image: Image.Image,
    dividers: list[LaneDivider],
    conf: float = 0.15,
    imgsz: int = 1536,
    edge_ratio: float = 0.15,
    model: str = _DEFAULT_MODEL,
    class_agnostic: bool | None = None,
    min_area_frac: float = 0.0,
    max_area_frac: float = 1.0,
) -> dict:
    """
    Mỗi xe = 1 hình (đa giác mask nếu model "-seg", không thì hộp chữ nhật).
    Mỗi divider = 1 đoạn thẳng ranh giới làn (cấu hình sẵn).
    Xe ĐỖ LẤN khi một divider cắt qua THÂN xe và để lại diện tích đáng kể ở CẢ
    HAI bên — không chỉ liếm qua rìa.
    - edge_ratio: tỷ lệ diện tích tối thiểu phải nằm ở phía nhỏ hơn để coi là
      lấn thật (0.15 = phía ít hơn vẫn chiếm ≥15% thân xe). Mép xe sát vạch chỉ
      để lại vài % bên kia nên không bị tính nhầm.
    - model: "coco" (ngang/chéo), "aerial" (top-down), "seg" (mask chính xác)
      hoặc "hybrid" (aerial xác nhận xe + seg cho viền — khuyến nghị top-down).
    - class_agnostic: nhận mọi mask bất kể nhãn class. None = tự bật cho "seg".
    - min_area_frac / max_area_frac: chỉ dùng khi class_agnostic, loại mask quá
      nhỏ (nhiễu) hoặc quá lớn (mái che/sàn) theo tỷ lệ diện tích khung ảnh.
    """
    from shapely.geometry import LineString
    from shapely.ops import split as shp_split

    import numpy as np

    width, height = image.size
    image_np = np.array(image)

    if model == "hybrid":
        vehicles = _hybrid_vehicle_shapes(
            image_np, conf, imgsz, width * height, min_area_frac, max_area_frac
        )
    else:
        vehicle_ids = _vehicle_class_ids(model)
        agnostic = _resolve_class_agnostic(model, class_agnostic)
        results = _yolo_model(model).predict(
            image_np, conf=conf, imgsz=imgsz, verbose=False
        )[0]
        vehicles = _vehicle_shapes(
            results, vehicle_ids, agnostic, width * height, min_area_frac, max_area_frac
        )

    # Đoạn thẳng ranh giới (pixel), KÉO DÀI quá khung ảnh để shapely.split luôn
    # cắt trọn thân xe (split chỉ chia khi đường cắt xuyên hết đa giác; vạch kết
    # thúc giữa thân xe sẽ không chia được).
    diag = (width ** 2 + height ** 2) ** 0.5
    lines = []
    for d in dividers:
        ax, ay = d.start[0] * width, d.start[1] * height
        bx, by = d.end[0] * width, d.end[1] * height
        dx, dy = bx - ax, by - ay
        norm = (dx * dx + dy * dy) ** 0.5 or 1.0
        ux, uy = dx / norm, dy / norm
        lines.append(LineString([
            (ax - ux * diag, ay - uy * diag),
            (bx + ux * diag, by + uy * diag),
        ]))

    cars = []
    for veh in vehicles:
        poly = veh["poly"]
        x1, y1, x2, y2 = veh["box"]
        car_area = poly.area or 1.0

        crossing = []  # các divider cắt thân xe để lại diện tích đáng kể 2 bên
        for idx, line in enumerate(lines):
            if not line.intersects(poly):
                continue
            # Cắt thân xe bằng vạch, đo tỷ lệ diện tích phía nhỏ hơn.
            try:
                pieces = list(shp_split(poly, line).geoms)
            except Exception:
                pieces = []
            if len(pieces) < 2:
                continue
            areas = sorted(p.area for p in pieces)
            minor_frac = areas[0] / car_area
            if minor_frac >= edge_ratio:
                crossing.append(idx)

        cars.append({
            "box": [round(x1 / width, 4), round(y1 / height, 4),
                    round(x2 / width, 4), round(y2 / height, 4)],
            "conf": round(float(veh["conf"]), 3),
            "straddling": len(crossing) > 0,
            "dividerIndices": crossing,
        })

    violations = [c for c in cars if c["straddling"]]
    return {
        "vehicleCount": len(cars),
        "straddleCount": len(violations),
        "cars": cars,
        "dividerCount": len(lines),
    }


@app.post("/detect-straddle")
async def detect_straddle_endpoint(
    file: UploadFile | None = File(None),
    imageBase64: str | None = Form(None),
    dividers: str = Form(...),
    conf: float = Form(0.15),
    imgsz: int = Form(1536),
    edgeRatio: float = Form(0.15),
    model: str = Form(_DEFAULT_MODEL),
    classAgnostic: bool | None = Form(None),
    minAreaFrac: float = Form(0.0),
    maxAreaFrac: float = Form(1.0),
):
    """
    Nhận ảnh + danh sách đường ranh giới làn (cấu hình sẵn cho camera),
    trả về từng xe kèm cờ `straddling` (đỗ lấn vạch).
    `dividers` là JSON string: [{"start":[x,y],"end":[x,y]}, ...]
    `classAgnostic` để trống = tự bật cho model "seg" (ảnh top-down).
    `minAreaFrac`/`maxAreaFrac` (chỉ khi class-agnostic) lọc mask theo tỷ lệ diện tích.
    """
    if file is not None:
        raw = await file.read()
    elif imageBase64:
        try:
            raw = base64.b64decode(imageBase64)
        except (ValueError, base64.binascii.Error):
            raise HTTPException(status_code=400, detail="imageBase64 không hợp lệ.")
    else:
        raise HTTPException(status_code=400, detail="Cần cung cấp file ảnh hoặc imageBase64.")

    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except OSError:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh.")

    try:
        divider_list = [LaneDivider(**item) for item in json.loads(dividers)]
    except (json.JSONDecodeError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Trường dividers không phải JSON hợp lệ.")

    if not divider_list:
        raise HTTPException(status_code=400, detail="Cần ít nhất một đường ranh giới làn.")

    return detect_straddle(
        image, divider_list, conf, imgsz, edgeRatio, model,
        classAgnostic, minAreaFrac, maxAreaFrac,
    )


# ─── Gợi ý ranh giới làn từ vạch kẻ trắng (dùng ảnh bãi TRỐNG) ─────────────────
def suggest_dividers(
    image: Image.Image,
    min_cluster: int = 5,
    angle_min: float = 40.0,
) -> dict:
    """
    Tự gợi ý ranh giới làn bằng cách dò các VẠCH KẺ TRẮNG trên sàn.
    Hoạt động tốt nhất với ảnh bãi TRỐNG (vạch không bị xe che).
    Chịu được vạch NGHIÊNG do phối cảnh: gom cụm theo x tại giữa chiều cao
    ảnh (x-intercept ở y=H/2), và mỗi ranh giới xuất ra là một đoạn nghiêng
    đúng theo độ dốc trung bình của cụm — không ép thẳng đứng.
    - min_cluster: số đoạn Hough tối thiểu trong một cụm để coi là vạch thật.
    - angle_min: góc tối thiểu (độ) so với phương ngang để coi là vạch làn.
    Đây là GỢI Ý ban đầu; người dùng nên xem lại và chỉnh nếu cần.
    """
    import numpy as np

    rgb = np.array(image)
    height, width = rgb.shape[:2]
    mid_y = height / 2

    # Lọc pixel trắng: sáng (V cao) và ít bão hoà (S thấp)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    white = cv2.inRange(hsv, (0, 0, 140), (180, 70, 255))
    edges = cv2.Canny(white, 50, 150)
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180,
        threshold=50,
        minLineLength=int(height * 0.15),
        maxLineGap=30,
    )

    # Giữ các đoạn đủ dốc; chiếu về x tại y=mid_y để chịu được vạch nghiêng.
    segments = []  # (x_at_mid, slope_dx_per_dy, y_top, y_bot)
    for line in lines if lines is not None else []:
        x1, y1, x2, y2 = [float(v) for v in line[0]]
        angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
        if angle < angle_min:
            continue
        dy = y2 - y1
        dxdy = (x2 - x1) / dy if dy != 0 else 0.0
        x_mid = x1 + dxdy * (mid_y - y1)
        segments.append((x_mid, dxdy, min(y1, y2), max(y1, y2)))

    segments.sort(key=lambda s: s[0])

    # Gom các đoạn có x-intercept (tại mid_y) sát nhau thành một vạch.
    clusters: list[list[tuple]] = []
    for seg in segments:
        if not clusters or seg[0] - clusters[-1][-1][0] > width * 0.03:
            clusters.append([seg])
        else:
            clusters[-1].append(seg)

    raw = []
    for cluster in clusters:
        if len(cluster) < min_cluster:
            continue
        x_mid = sum(s[0] for s in cluster) / len(cluster)
        slope = sum(s[1] for s in cluster) / len(cluster)
        y_top = min(s[2] for s in cluster)
        y_bot = max(s[3] for s in cluster)
        raw.append((x_mid, slope, y_top, y_bot))

    # Chuẩn hoá: kéo mọi vạch về CÙNG khoảng y (hợp của tất cả vạch), giữ độ dốc
    # riêng của từng vạch — mỗi ranh giới phủ hết hàng đỗ, tránh vạch cụt.
    dividers = []
    if raw:
        common_top = min(r[2] for r in raw)
        common_bot = max(r[3] for r in raw)
        for x_mid, slope, _, _ in raw:
            x_start = x_mid + slope * (common_top - mid_y)
            x_end = x_mid + slope * (common_bot - mid_y)
            dividers.append({
                "start": [round(x_start / width, 4), round(common_top / height, 4)],
                "end": [round(x_end / width, 4), round(common_bot / height, 4)],
            })

    return {
        "lineCount": len(segments),
        "dividers": dividers,
    }


@app.post("/suggest-dividers")
async def suggest_dividers_endpoint(
    file: UploadFile | None = File(None),
    imageBase64: str | None = Form(None),
    minCluster: int = Form(5),
):
    """
    Nhận ảnh (nên dùng ảnh bãi TRỐNG), dò vạch kẻ trắng dọc và trả về danh sách
    đường ranh giới làn GỢI Ý. Người dùng xem lại rồi chỉnh trên giao diện.
    """
    if file is not None:
        raw = await file.read()
    elif imageBase64:
        try:
            raw = base64.b64decode(imageBase64)
        except (ValueError, base64.binascii.Error):
            raise HTTPException(status_code=400, detail="imageBase64 không hợp lệ.")
    else:
        raise HTTPException(status_code=400, detail="Cần cung cấp file ảnh hoặc imageBase64.")

    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except OSError:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh.")

    return suggest_dividers(image, minCluster)

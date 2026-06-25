import base64
import os
import re
import tempfile
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import cv2
import pytesseract

# Allow overriding tesseract binary path via environment variable.
# Example: set TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
_tesseract_cmd = os.environ.get("TESSERACT_CMD", "")
if _tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd
elif os.path.isfile(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageFilter, ImageOps
from pydantic import BaseModel

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
    import numpy as np
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
    import numpy as np
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


def detect_plate(image_path: Path) -> dict:
    image = Image.open(image_path).convert("RGB")
    best_text = ""
    best_confidence = 0
    best_plate = ""

    for variant in preprocess_variants(image):
        data = pytesseract.image_to_data(
            variant,
            lang="eng+vie",
            config="--psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-. ",
            output_type=pytesseract.Output.DICT,
        )
        words = []
        confidences = []
        for word, confidence in zip(data.get("text", []), data.get("conf", [])):
            clean = word.strip()
            try:
                score = int(float(confidence))
            except ValueError:
                score = -1
            if clean and score >= 0:
                words.append(clean)
                confidences.append(score)

        raw_text = " ".join(words)
        plate = extract_plate(raw_text)
        confidence = int(sum(confidences) / len(confidences)) if confidences else 0
        if plate and confidence >= best_confidence:
            best_plate = plate
            best_text = raw_text
            best_confidence = confidence

    return {
        "plate": best_plate,
        "confidence": best_confidence,
        "rawText": best_text,
        "vehicleType": detect_vehicle_type(image),
        "imageHash": average_hash(image),
    }


@app.get("/health")
def health():
    return {"ok": True}


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

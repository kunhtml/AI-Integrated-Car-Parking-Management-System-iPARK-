"""
Benchmark tốc độ OCR ảnh bằng PaddleOCR cho dịch vụ iPARK.

Ví dụ:
    python test_ocr_speed.py --input .\test_images
    python test_ocr_speed.py --input .\bien-so.jpg --repeat 5 --warmup 1
    python test_ocr_speed.py --input .\test_images --repeat 3 --save-json .\ocr_speed.json

Thời gian OCR được đo riêng, không bao gồm thời gian khởi tạo model.
Thời gian khởi tạo model vẫn được báo cáo riêng để dễ đánh giá tổng thời gian chạy.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

try:
    import cv2
except ImportError as exc:
    raise SystemExit(
        "Thiếu opencv-python. Hãy chạy: pip install opencv-python"
    ) from exc

try:
    from paddleocr import PaddleOCR
except ImportError as exc:
    raise SystemExit(
        "Thiếu PaddleOCR/PaddlePaddle. Hãy cài requirements.txt của ai-service "
        "trước khi chạy script."
    ) from exc


SUPPORTED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp",
    ".tif",
    ".tiff",
}


@dataclass
class ImageBenchmark:
    """Kết quả benchmark của một ảnh."""

    image: str
    width: int
    height: int
    runs: int
    texts: list[str]
    latencies_ms: list[float]
    average_ms: float
    min_ms: float
    max_ms: float
    ocr_fps: float


@dataclass
class FailedImage:
    """Thông tin ảnh không thể xử lý."""

    image: str
    error: str


def configure_stdout() -> None:
    """Đảm bảo tiếng Việt hiển thị đúng trên Windows và terminal khác."""

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Đo tốc độ OCR ảnh bằng PaddleOCR và hiển thị kết quả ra terminal."
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Đường dẫn tới một ảnh hoặc thư mục chứa ảnh.",
    )
    parser.add_argument(
        "--repeat",
        type=int,
        default=1,
        help="Số lần OCR trên mỗi ảnh để tính trung bình (mặc định: 1).",
    )
    parser.add_argument(
        "--warmup",
        type=int,
        default=1,
        help="Số lần chạy làm nóng model, không tính vào benchmark (mặc định: 1).",
    )
    parser.add_argument(
        "--lang",
        default="en",
        help="Ngôn ngữ PaddleOCR, mặc định là en để đọc biển số xe.",
    )
    parser.add_argument(
        "--use-angle-cls",
        action="store_true",
        help="Bật nhận diện góc xoay; chính xác hơn nhưng thường chậm hơn.",
    )
    parser.add_argument(
        "--save-json",
        type=Path,
        default=None,
        help="Tùy chọn: lưu báo cáo chi tiết vào file JSON.",
    )
    args = parser.parse_args()
    if args.repeat < 1:
        parser.error("--repeat phải lớn hơn hoặc bằng 1.")
    if args.warmup < 0:
        parser.error("--warmup phải lớn hơn hoặc bằng 0.")
    return args


def collect_images(input_path: Path) -> list[Path]:
    """Lấy danh sách ảnh từ một file hoặc toàn bộ thư mục con."""

    input_path = input_path.expanduser()
    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"File không phải định dạng ảnh được hỗ trợ: {input_path.suffix}"
            )
        return [input_path]

    if input_path.is_dir():
        images = sorted(
            p
            for p in input_path.rglob("*")
            if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
        )
        if images:
            return images
        raise FileNotFoundError(
            f"Không tìm thấy ảnh trong thư mục: {input_path}"
        )

    raise FileNotFoundError(f"Không tìm thấy đường dẫn input: {input_path}")


def is_prediction_item(value: Any) -> bool:
    """Nhận biết một prediction dạng [box, (text, score)]."""

    if not isinstance(value, (list, tuple)) or len(value) < 2:
        return False
    recognition = value[1]
    return (
        isinstance(recognition, (list, tuple))
        and len(recognition) >= 2
        and isinstance(recognition[0], str)
    )


def extract_texts(result: Any) -> list[str]:
    """Trích text từ output PaddleOCR 2.x, kể cả output lồng nhiều lớp."""

    texts: list[str] = []

    def walk(node: Any) -> None:
        if is_prediction_item(node):
            recognition = node[1]
            text = str(recognition[0]).strip()
            if text:
                texts.append(text)
            return

        if isinstance(node, dict):
            # Tương thích thêm với một số output PaddleOCR dạng dict.
            rec_texts = node.get("rec_texts")
            if isinstance(rec_texts, Iterable) and not isinstance(rec_texts, (str, bytes)):
                for text in rec_texts:
                    text = str(text).strip()
                    if text:
                        texts.append(text)
                return
            for value in node.values():
                walk(value)
            return

        if isinstance(node, (list, tuple)):
            for child in node:
                walk(child)

    walk(result)
    return texts


def format_texts(texts: list[str]) -> str:
    return " | ".join(texts) if texts else "(không nhận diện được text)"


def create_ocr(lang: str, use_angle_cls: bool) -> Any:
    """Khởi tạo PaddleOCR theo đúng cách dịch vụ app.py đang dùng."""

    return PaddleOCR(
        use_angle_cls=use_angle_cls,
        lang=lang,
        show_log=False,
    )


def benchmark_image(ocr: Any, path: Path, repeat: int, use_angle_cls: bool) -> ImageBenchmark:
    image = cv2.imread(str(path))
    if image is None:
        raise ValueError("OpenCV không đọc được ảnh hoặc ảnh bị hỏng.")

    height, width = image.shape[:2]
    latencies_ms: list[float] = []
    texts: list[str] = []

    for _ in range(repeat):
        started = time.perf_counter()
        result = ocr.ocr(image, cls=use_angle_cls)
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        latencies_ms.append(elapsed_ms)
        texts = extract_texts(result)

    average_ms = statistics.fmean(latencies_ms)
    return ImageBenchmark(
        image=str(path),
        width=width,
        height=height,
        runs=repeat,
        texts=texts,
        latencies_ms=[round(value, 3) for value in latencies_ms],
        average_ms=round(average_ms, 3),
            min_ms=round(min(latencies_ms), 3),
        max_ms=round(max(latencies_ms), 3),
        ocr_fps=round(1000.0 / average_ms, 3) if average_ms > 0 else 0.0,
    )


def print_image_result(result: ImageBenchmark) -> None:
    print(
        f"  {Path(result.image).name}: "
        f"{result.width}x{result.height} | "
        f"avg {result.average_ms:.3f} ms | "
        f"{result.ocr_fps:.3f} ảnh/giây | "
        f"text: {format_texts(result.texts)}"
    )


def print_summary(
    results: list[ImageBenchmark],
    failures: list[FailedImage],
    model_load_ms: float,
    warmup_runs: int,
) -> dict[str, Any]:
    all_latencies = [latency for item in results for latency in item.latencies_ms]
    total_ocr_ms = sum(all_latencies)
    total_runs = len(all_latencies)
    average_ms = statistics.fmean(all_latencies) if all_latencies else 0.0
    summary = {
        "model_load_ms": round(model_load_ms, 3),
        "warmup_runs": warmup_runs,
        "images_ok": len(results),
        "images_failed": len(failures),
        "total_ocr_runs": total_runs,
        "total_ocr_ms": round(total_ocr_ms, 3),
        "average_ocr_ms": round(average_ms, 3),
        "ocr_fps": round(1000.0 / average_ms, 3) if average_ms > 0 else 0.0,
    }

    print("\n========== TỔNG KẾT TỐC ĐỘ OCR ==========")
    print("Model sử dụng:     PaddleOCR")
    print(f"Ảnh thành công:   {summary['images_ok']}")
    print(f"Ảnh lỗi:          {summary['images_failed']}")
    print(f"Tổng lượt OCR:    {summary['total_ocr_runs']}")
    print(f"Tổng thời gian:   {summary['total_ocr_ms']:.3f} ms")
    print(f"Trung bình:       {summary['average_ocr_ms']:.3f} ms/ảnh")
    print(f"Tốc độ OCR:       {summary['ocr_fps']:.3f} ảnh/giây")

    if failures:
        print("\nẢnh không xử lý được:")
        for failure in failures:
            print(f"  - {failure.image}: {failure.error}")
    return summary


def main() -> int:
    configure_stdout()
    args = parse_args()

    try:
        image_paths = collect_images(Path(args.input))
    except (FileNotFoundError, ValueError) as exc:
        print(f"Lỗi input: {exc}", file=sys.stderr)
        return 2

    print(f"Tìm thấy {len(image_paths)} ảnh.")
    print(f"Ngôn ngữ: {args.lang} | repeat: {args.repeat} | warm-up: {args.warmup}")
    print("Đang khởi tạo PaddleOCR...")
    load_started = time.perf_counter()
    try:
        ocr = create_ocr(args.lang, args.use_angle_cls)
    except Exception as exc:
        print(f"Không thể khởi tạo PaddleOCR: {exc}", file=sys.stderr)
        return 3
    model_load_ms = (time.perf_counter() - load_started) * 1000.0

    # Đọc ảnh đầu tiên một lần để warm-up model trước khi đo tốc độ thật.
    first_image = cv2.imread(str(image_paths[0]))
    if first_image is None:
        print(f"Không đọc được ảnh warm-up: {image_paths[0]}", file=sys.stderr)
        return 4
    print(f"Khởi tạo model xong trong {model_load_ms:.3f} ms.")
    for warmup_index in range(args.warmup):
        try:
            ocr.ocr(first_image, cls=args.use_angle_cls)
        except Exception as exc:
            print(f"Warm-up lần {warmup_index + 1} thất bại: {exc}", file=sys.stderr)
            return 5
    if args.warmup:
        print("Warm-up hoàn tất; bắt đầu đo OCR...\n")

    results: list[ImageBenchmark] = []
    failures: list[FailedImage] = []
    for path in image_paths:
        try:
            result = benchmark_image(ocr, path, args.repeat, args.use_angle_cls)
            results.append(result)
            print_image_result(result)
        except Exception as exc:
            failures.append(FailedImage(image=str(path), error=str(exc)))
            print(f"  {path.name}: lỗi - {exc}")

    summary = print_summary(results, failures, model_load_ms, args.warmup)

    if args.save_json:
        report = {
            "config": {
                "input": str(Path(args.input).expanduser()),
                "repeat": args.repeat,
                "warmup": args.warmup,
                "lang": args.lang,
                "use_angle_cls": args.use_angle_cls,
                "note": "Latency chỉ đo lệnh OCR, chưa gồm thời gian đọc file và load model.",
            },
            "summary": summary,
            "images": [asdict(item) for item in results],
            "failures": [asdict(item) for item in failures],
        }
        args.save_json.parent.mkdir(parents=True, exist_ok=True)
        args.save_json.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\nĐã lưu báo cáo JSON: {args.save_json.resolve()}")

    return 0 if results else 6


if __name__ == "__main__":
    raise SystemExit(main())


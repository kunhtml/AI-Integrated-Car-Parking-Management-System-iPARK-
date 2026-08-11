Thư mục chứa model YOLO train riêng cho biển số VN
====================================================

Đặt file model vào đây sau khi train:
  license_plate.pt

Cách train:
  1. Mở Google Colab
  2. Chạy script train_plate_yolov8.py
  3. Tải file license_plate.pt về
  4. Copy vào thư mục này

Cấu hình env (tuỳ chọn):
  PLATE_YOLO_MODEL=models/license_plate.pt

Nếu chưa có model biển số, hệ thống sẽ tự dùng pipeline cũ:
  YOLO detect xe → Contour tìm biển → PaddleOCR

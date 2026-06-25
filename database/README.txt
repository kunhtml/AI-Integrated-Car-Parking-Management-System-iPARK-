========================================
  iPARK - HƯỚNG DẪN CHẠY SEED DATABASE
========================================

FILE CHÍNH: seed.js
-------------------
Chạy 1 lệnh duy nhất để tạo toàn bộ dữ liệu:

  mongosh mongodb://127.0.0.1:27017/ipark seed.js

Hoặc paste nội dung seed.js vào tab mongosh trong MongoDB Compass.

========================================
  CÁC COLLECTION SẼ ĐƯỢC TẠO
========================================

  Collection            | Số bản ghi | Nội dung
  ----------------------|------------|---------------------------
  users                 | 4          | 1 admin, 2 nhân viên, 1 khách
  pricingconfigs        | 1          | Cấu hình phí gửi xe
  paymentconfigs        | 1          | Ngân hàng VietinBank
  devices               | 2          | Camera cổng vào + cổng ra
  membershippackages    | 3          | Gói ngày, tháng, năm VIP
  zones                 | 3          | Khu A, B, C (10 chỗ/khu)
  vehicles              | 2          | 2 xe của khách hàng mẫu
  parkingsessions       | 2          | 1 đã xong, 1 đang gửi
  transactions          | 2          | Nạp tiền + thanh toán
  notifications         | 2          | Thông báo mẫu

========================================
  TÀI KHOẢN SAU KHI SEED
========================================

  Email               | Mật khẩu | Vai trò
  --------------------|----------|----------
  admin@ipark.vn      | admin    | Quản trị viên
  nv.1@ipark.vn       | 123456   | Nhân viên cổng 1
  nv.2@ipark.vn       | 123456   | Nhân viên cổng 2
  kh.1@gmail.com      | 123456   | Khách hàng

========================================
 HƯỚNG DẪN IMPORT VÀO MONGODB COMPASS
========================================

DATABASE NAME: ipark

DANH SÁCH COLLECTION & FILE JSON:
----------------------------------
  Collection            | File
  ----------------------|---------------------------
  users                 | users.json
  pricingconfigs        | pricingconfigs.json
  paymentconfigs        | paymentconfigs.json
  devices               | devices.json
  membershippackages    | membershippackages.json
  zones                 | zones.json
  vehicles              | vehicles.json
  parkingsessions       | parkingsessions.json
  transactions          | transactions.json

CÁCH IMPORT TRONG MONGODB COMPASS:
-----------------------------------
1. Mở MongoDB Compass → kết nối mongodb://127.0.0.1:27017
2. Tạo database "ipark" (nếu chưa có)
3. Với mỗi collection:
   a. Click "Create Collection" → đặt tên đúng như bảng trên
   b. Vào collection → click "Add Data" → "Import JSON or CSV file"
   c. Chọn file .json tương ứng → Import

LƯU Ý QUAN TRỌNG:
------------------
- File users.json chứa passwordHash là PLACEHOLDER.
  Để có hash thật, hãy chạy lệnh seed:
    cd backend
    npm run seed
  Lệnh seed sẽ tự tạo đúng bcrypt hash cho mật khẩu.

- Mật khẩu thực tế  
    admin@ipark.vn  → "admin"
    nv.1@ipark.vn   → "123456"
    nv.2@ipark.vn   → "123456"
    kh.1@gmail.com  → "123456"

KHUYẾN NGHỊ:
------------
Dùng lệnh seed thay vì import thủ công để đảm bảo
password hash đúng và dữ liệu nhất quán.

  cd backend
  npm run seed

========================================

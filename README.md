# iPARK — Hệ thống quản lý bãi đỗ xe thông minh

Hệ thống quản lý bãi đỗ xe toàn diện với nhận diện biển số AI, theo dõi realtime, thanh toán PayOS, tra cứu & trả phí trước cho khách vãng lai, gói thành viên (gửi xe miễn phí), đặt chỗ trước và báo cáo phân tích.

## Kiến trúc

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Frontend   │────▶│   Backend    │────▶│   AI Service    │
│  Next.js    │     │  Express.js  │     │   FastAPI/OCR   │
│  Port 3000  │     │  Port 4000   │     │   Port 5000     │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────▼───────┐
                    │   MongoDB    │
                    │  Port 27017  │
                    └──────────────┘
```

---

## Yêu cầu hệ thống

- **Node.js** 20+ và npm 10+
- **Python** 3.10–3.12 (cho AI service)
- **MongoDB** (local hoặc Atlas)
- **Tesseract OCR** (cho nhận diện biển số)

### Cài Tesseract (Windows)

Tải tại: https://github.com/UB-Mannheim/tesseract/wiki  
Cài xong set biến môi trường `TESSERACT_CMD` hoặc để mặc định `C:\Program Files\Tesseract-OCR\tesseract.exe`

---

## Cài đặt & Chạy

### 1. Clone và cài dependencies

```bash
git clone https://github.com/trthanhdo41/bai-do-xe.git
cd bai-do-xe
npm install
```

### 2. Cấu hình Backend

Copy file `.env.example` thành `.env` trong thư mục `backend/`:

```bash
cd backend
cp .env.example .env
```

Chỉnh sửa `backend/.env` theo hướng dẫn bên dưới (mục Cấu hình).

### 3. Chạy MongoDB

```bash
# Nếu dùng MongoDB local
mongod

# Hoặc dùng MongoDB Atlas — chỉnh MONGODB_URI trong .env
```

### 4. Seed dữ liệu ban đầu

```bash
npm run seed
```

Seed tạo: 3 zones (A/B/C), 30 parking slots, tài khoản admin + 3 staff, bảng giá mặc định (miễn phí 20 phút, ngày 5.000đ, đêm 10.000đ).

### 5. Chạy Backend

```bash
cd backend
npm run dev
```

Backend chạy tại `http://localhost:4000`

### 6. Chạy AI Service

```bash
cd ai-service
pip install -r requirements.txt
python -m uvicorn main:app --port 5000
```

AI service chạy tại `http://localhost:5000`

### 7. Chạy Frontend

```bash
cd frontend
npm run dev
```

Frontend chạy tại `http://localhost:3000`

---

## Cấu hình (.env)

File `backend/.env` — các mục cần cấu hình:

### SMTP (Gửi email OTP)

> ⚠️ Hiện đang cấu hình sẵn SMTP Gmail của developer. Khách hàng cần thay bằng email riêng.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-16-chars
SMTP_FROM=iPARK <your-email@gmail.com>
```

Để tạo App Password Gmail: https://myaccount.google.com/apppasswords

### PayOS (Thanh toán tự động)

> Thanh toán qua PayOS. Khi chạy local (không có webhook public), nút "Kiểm tra thanh toán" sẽ chủ động hỏi PayOS API để xác nhận. Khi deploy có webhook HTTPS thì xác nhận tự động. Cần PayOS credentials từ https://payos.vn.

```env
PAYTOS_CLIENT_ID=your_payos_client_id
PAYTOS_API_KEY=your_payos_api_key
PAYTOS_CHECKSUM_KEY=your_payos_checksum_key
PAYTOS_WEBHOOK_URL=https://your-domain.com/api/payos/webhook
```

> ⚠️ `PAYTOS_WEBHOOK_URL` phải là HTTPS và accessible từ internet để PayOS gửi webhook. Dùng ngrok hoặc deploy để test local.

**Cấu hình thông tin ngân hàng** (hiển thị trên QR cho khách):

```env
PAYMENT_BANK_NAME=Ngân hàng TMCP Việt Nam VietinBank
PAYMENT_BANK_BIN=970436
PAYMENT_ACCOUNT_NUMBER=123456789012
PAYMENT_ACCOUNT_NAME=CONG TY TNHH AIPARK
PAYMENT_TRANSFER_PREFIX=IPARK
```

> Thông tin ngân hàng dùng để hiển thị tài khoản trên QR code. Khách chuyển khoản thủ công vào tài khoản này vẫn được xác nhận qua PayOS webhook.

Tra BIN ngân hàng tại: https://www.vietqr.io/danh-sach-ngan-hang

### Google OAuth (Đăng nhập Google)

> Tùy chọn — bỏ trống nếu không cần.

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

### AI Service

```env
AI_SERVICE_URL=http://127.0.0.1:5000
```

### MongoDB

```env
MONGODB_URI=mongodb://127.0.0.1:27017/bai-do-xe
```

---

## Tài khoản mặc định (sau khi seed)

| Email | Mật khẩu | Vai trò |
|---|---|---|
| admin@ipark.vn | admin | Admin |
| nv.1@ipark.vn | 123456 | Staff |
| nv.2@ipark.vn | 123456 | Staff |

---

## Tổng quan chức năng

### Xác thực
- Đăng ký/đăng nhập Email + Google OAuth
- Quên mật khẩu qua OTP email (gửi thật)
- Xác thực 2FA (TOTP) cho Admin
- Quản lý phiên đăng nhập (xem/thu hồi)
- Đổi mật khẩu

### Khách vãng lai (không cần đăng nhập)
- Tra cứu phí theo biển số ở trang chủ
- Chọn ngày + ca (trước/sau 22h) để tính & trả phí trước qua QR PayOS
- Gia hạn thêm ngày cho xe đã trả trước, còn trong bãi (trả thêm phần chênh lệch)
- Xem chỗ trống realtime theo zone

### Khách hàng (đăng nhập)
- Xem phiên đỗ xe, lịch sử, chi tiết phí
- Đặt chỗ trước (slot VIP/Điện/Handicap)
- Mua gói thành viên tháng/quý/năm: gửi xe **miễn phí, không giới hạn xe, mọi biển số**
- Sau khi thanh toán gói → được cấp **mã thành viên + mã QR** (gắn với tài khoản)
- Gia hạn gói khi hết hạn (trả thêm tiền, cộng tiếp thời hạn); hủy gói vẫn dùng được tới hết hạn
- Nạp tiền ví, thanh toán phiên qua QR PayOS trong ví
- Tải biên lai PDF
- Gửi phản hồi
- Nhận thông báo (đăng ký, checkout, phạt, ví thấp, khuyến mãi)

### Nhân viên
- Check-in/out xe bằng ảnh (AI nhận diện biển số)
- Nhập **mã thành viên** khi xe vào → phiên đánh dấu đã thanh toán, chỉ chờ checkout
- Xác minh thủ công khi AI sai
- Quản lý ca làm việc + nộp báo cáo ca
- Báo cáo sự cố
- Miễn phạt quá hạn

### Admin
- Quản lý khu vực (Zone) + vị trí đỗ (ParkingSlot)
- Cấu hình bảng giá (miễn phí, giá ngày/đêm, qua đêm, phạt quá hạn)
- Quản lý gói thành viên (CRUD plans: tên, thời hạn, giá)
- Quản lý người dùng (CRUD, khóa/mở, phân quyền)
- Quản lý phương tiện + blacklist
- Quản lý camera (CRUD, snapshot, restart, bảo trì)
- Mẫu thông báo (templates)
- Xác nhận giao dịch nạp tiền
- Gửi thông báo khuyến mãi

### Báo cáo & Phân tích
- Doanh thu theo ngày/tuần/tháng (biểu đồ)
- Tỷ lệ lấp đầy theo giờ
- Top khách hàng thân thiết
- Heatmap giờ cao điểm
- Báo cáo xe vào/ra theo zone
- Báo cáo phạt quá hạn
- Báo cáo hoạt động ví
- Xuất PDF / Excel

### AI Service
- Nhận diện biển số (Tesseract OCR)
- Phát hiện loại xe (OpenCV contour)
- Phát hiện biển số trùng lặp
- So khớp ảnh vào/ra (image hash)
- Snapshot camera RTSP

### Background Jobs (tự động)
- Auto-renew gói thành viên bật autoRenew (mỗi 5 phút)
- Expire gói hết hạn + nhắc hết hạn/nhắc trả trước (mỗi 5 phút)
- Expire đặt chỗ quá hạn + dọn slot bị kẹt (mỗi 10 phút)
- Kiểm tra camera offline (mỗi 15 phút)
- Đánh dấu phiên quá hạn (mỗi 30 phút)

---

## Cấu trúc project

```
bai-do-xe/
├── frontend/          # Next.js (App Router)
│   └── src/
│       ├── app/       # Pages
│       ├── features/  # Feature views (sessions, zones, reports...)
│       ├── hooks/     # Action hooks (auth, session, slot...)
│       ├── context/   # Global state (ParkingAppContext)
│       └── lib/       # Utils, API client, toast
├── backend/           # Express + TypeScript
│   └── src/
│       ├── controllers/
│       ├── models/    # Mongoose schemas
│       ├── routes/
│       ├── services/  # Business logic
│       └── config/
├── ai-service/        # FastAPI + Tesseract + OpenCV
│   └── main.py
└── README.md
```

---

## API Endpoints (tóm tắt)

| Nhóm | Base path | Mô tả |
|---|---|---|
| Auth | `/api/auth` | Login, register, OTP, 2FA, sessions |
| Users | `/api/users` | CRUD users |
| Vehicles | `/api/vehicles` | CRUD phương tiện |
| Zones | `/api/zones` | CRUD khu vực |
| Parking Slots | `/api/parking-slots` | CRUD + slot map |
| Parking Sessions | `/api/parking-sessions` | Check-in/out, upload, camera |
| Reservations | `/api/reservations` | Đặt chỗ trước |
| Subscriptions | `/api/subscriptions` | Gói thành viên + plans + mã thành viên |
| Transactions | `/api/transactions` | Thanh toán phiên, nạp ví |
| Pricing | `/api/pricing-config` | Cấu hình giá ngày/đêm |
| Reports | `/api/reports` | Báo cáo & analytics |
| Devices | `/api/devices` | Camera + bảo trì |
| Notifications | `/api/notifications` | Thông báo |
| Templates | `/api/notification-templates` | Mẫu thông báo |
| Shifts | `/api/shifts` | Ca làm việc |
| Incidents | `/api/incidents` | Sự cố |
| Feedback | `/api/feedback` | Phản hồi |
| PayOS | `/api/payos` | Webhook + return URL PayOS |
| Public | `/api/public` | Chỗ trống, tra cứu, trả/gia hạn phí (không cần auth) |

---

## Lưu ý triển khai

- **SMTP:** Đang dùng Gmail App Password của developer. Khách hàng thay bằng email riêng trong `.env`
- **PayOS:** Cần Client ID + API Key + Checksum Key. Local: dùng nút "Kiểm tra thanh toán" (hỏi PayOS API). Production: cấu hình webhook HTTPS để xác nhận tự động
- **AI Service:** Cần Tesseract OCR cài trên máy. Ảnh biển số rõ ràng cho kết quả tốt nhất
- **MongoDB:** Khuyến nghị dùng local cho dev, Atlas cho production
- **Background Jobs:** Chạy tự động khi backend start, không cần cron bên ngoài

---

© 2026 iPARK — Hệ thống quản lý bãi đỗ xe thông minh

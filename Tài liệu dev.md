# Tài liệu dev - Dự án iPARK

## 1. Mục đích dự án

iPARK là hệ thống web quản lý bãi đỗ xe ô tô tại Hòa Lạc, Thạch Thất, Hà Nội.

Thông tin hiện có:

- Tên bãi xe: iPARK.
- Địa chỉ: Hòa Lạc, Thạch Thất, Hà Nội.
- Email liên hệ: `support@ipark.vn`.
- Hotline: chưa cung cấp.
- Chỉ quản lý ô tô, không làm xe máy.
- Sức chứa: 30 ô tô.
- Chia khu: A/B/C, mỗi khu 10 chỗ.
- Miễn phí: 20 phút đầu.
- Tính phí theo ngày/đêm: ra trước 22h tính giá ngày (mặc định 5.000đ/ngày), ra sau 22h hoặc qua đêm tính giá đêm (mặc định 10.000đ/ngày). Mỗi ngày lịch tính phí một lần.
- Khách vãng lai có thể tra cứu biển số, trả phí trước qua QR PayOS, và gia hạn thêm ngày.
- Thành viên (mua gói tháng/quý/năm) gửi xe miễn phí, không giới hạn xe, mọi biển số; được cấp mã thành viên + QR.
- Chạy local trước, chưa deploy production.

Luồng chính:

1. Nhân viên đăng nhập.
2. Xe vào: nhân viên upload ảnh xe vào.
3. Python AI service OCR biển số.
4. Hệ thống tạo phiên đỗ xe, lưu ảnh/biển số/slot vào MongoDB.
5. Xe ra: nhân viên upload ảnh xe ra.
6. AI OCR biển số ảnh ra.
7. Hệ thống match biển số vào/ra và tính điểm tương đồng ảnh xe.
8. Nếu khớp, hệ thống checkout và tính phí.
9. Nếu không khớp hoặc OCR lỗi, nhân viên xác minh thủ công.

## 2. Công nghệ và cấu trúc

- Frontend: Next.js, React, TypeScript, nằm trong `frontend/`.
- Backend API: Express, TypeScript, mô hình MVC, nằm trong `backend/`.
- Database: MongoDB local.
- Auth: JWT cookie `httpOnly`.
- Password hash: `bcrypt`.
- ORM/ODM: Mongoose.
- AI/OCR: Python FastAPI + Tesseract OCR.
- UI icon: lucide-react.

Cấu trúc chính:

```text
frontend/
  src/app/page.tsx
  src/lib/client-api.ts
  src/lib/parking-config.ts

backend/
  src/config/
  src/controllers/
  src/middlewares/
  src/models/
  src/routes/
  src/services/
  src/utils/
  src/app.ts
  src/server.ts

ai-service/
  main.py
  requirements.txt
```

Quy ước MVC backend:

- `routes/`: khai báo endpoint.
- `controllers/`: nhận request/response, validate input.
- `models/`: schema MongoDB/Mongoose.
- `services/`: logic dùng lại như OCR, upload, tính match biển số.
- `middlewares/`: auth, role guard, upload file, error handler.

## 3. Chuẩn kiến trúc đồ án kỹ thuật phần mềm

Dự án nên trình bày theo kiến trúc 3 khối rõ ràng:

```text
Client Layer
  Frontend Next.js
  - Hiển thị UI
  - Gọi API backend
  - Không xử lý nghiệp vụ database

Application Layer
  Backend Express MVC
  - Routes: định tuyến API
  - Controllers: nhận request, validate, trả response
  - Services: xử lý nghiệp vụ
  - Models: định nghĩa dữ liệu MongoDB
  - Middlewares: auth, role, upload, error

AI/Infrastructure Layer
  AI service Python FastAPI
  MongoDB local
  File storage local
  Camera RTSP
```

Không để frontend gọi trực tiếp MongoDB. Không để logic tính phí, phân quyền, checkout nằm trong UI. UI chỉ gọi API và hiển thị kết quả.

### 3.1. Mô hình MVC backend

Luồng xử lý chuẩn:

```text
Request
  -> Route
  -> Middleware
  -> Controller
  -> Service
  -> Model/MongoDB
  -> Controller response
```

Ví dụ luồng login:

```text
POST /api/auth/login
  -> auth.routes.ts
  -> auth.controller.ts
  -> User model
  -> token.service.ts
  -> set JWT cookie
```

Ví dụ luồng xe vào bằng ảnh:

```text
POST /api/parking-sessions/upload
  -> parkingSessions.routes.ts
  -> upload.middleware.ts
  -> parkingSessions.controller.ts
  -> ai.service.ts gọi Python OCR
  -> upload.service.ts lưu ảnh
  -> ParkingSession model lưu MongoDB
```

### 3.2. Actors và use cases

Actors:

- Super Admin.
- Nhân viên cổng.
- Khách hàng (có tài khoản).
- Khách vãng lai (không đăng nhập).
- AI Service.
- MongoDB.
- Camera RTSP.
- Cổng thanh toán PayOS.

Use cases chính:

- Đăng nhập/đăng xuất.
- Quản lý nhân viên.
- Quản lý phương tiện.
- Ghi nhận xe vào bằng ảnh (hoặc nhập mã thành viên).
- Nhận diện biển số xe vào.
- Ghi nhận xe ra bằng ảnh.
- Đối chiếu biển số xe vào/ra.
- Xác minh thủ công khi OCR lỗi.
- Tính phí gửi xe theo ngày/đêm.
- Khách vãng lai tra cứu & trả phí trước qua QR PayOS, gia hạn thêm ngày.
- Mua/gia hạn/hủy gói thành viên, cấp mã thành viên + QR.
- Nạp ví, xem lịch sử giao dịch.
- Xem lịch sử phiên đỗ xe.
- Xuất báo cáo.
- Quản lý camera.

### 3.3. Entity/database hiện tại

Các entity đã có:

```text
User
  _id
  name
  email
  passwordHash
  role: admin | staff | customer
  status
  wallet
  memberCode (mã thành viên IPK-XXXXXX, gắn khi mua gói)
  twoFactorEnabled
  createdAt
  updatedAt

Vehicle
  _id
  plate
  ownerName
  vehicleType: Ô tô
  status: Đã đăng ký | Cần duyệt | Blacklist
  userId
  createdAt
  updatedAt

ParkingSession
  _id
  plate
  ownerName
  vehicleType: Ô tô
  checkInAt
  checkOutAt
  expectedCheckOutAt / prepaidCheckoutAt (giờ ra dự kiến khi trả/gia hạn trước)
  slot, slotId
  status: Đang gửi | Đã hoàn thành | Đã hủy
  paymentStatus: unpaid | partial_paid | fully_paid
  fee, paidAmount, feeBreakdown
  entryImageUrl / exitImageUrl
  entryDetectedPlate / exitDetectedPlate
  entryConfidence / exitConfidence
  entryImageHash / exitImageHash
  vehicleMatchScore, matchStatus, verificationStatus
  ownerUserId, ownerEmail
  createdBy
  createdAt
  updatedAt
```

Các entity khác đã có trong `backend/src/models`:

```text
PricingConfig      bảng giá (freeMinutes, dayRate, nightRate, overnightRate, monthlyRate, overdueFineRate)
Transaction        giao dịch (payos), trạng thái pending/paid/failed/cancelled, payosOrderCode
SubscriptionPlan   gói thành viên: name, duration (monthly/quarterly/yearly), durationDays, price
Subscription       gói đã mua: userId, planId, startDate, endDate, status (active/cancelled/expired/pending_payment)
Feedback, Notification, NotificationTemplate
Shift, Incident
Device, DeviceMaintenanceLog
Reservation
OtpToken
ActiveSession
```

### 3.4. Sequence luồng xe vào/ra

Xe vào:

```text
Staff UI
  -> Backend POST /api/parking-sessions/upload?action=entry
  -> Upload middleware nhận ảnh
  -> AI service /detect
  -> Backend nhận plate/confidence/imageHash
  -> Backend cấp slot A/B/C
  -> MongoDB tạo ParkingSession
  -> UI hiển thị phiên đang gửi
```

Xe ra:

```text
Staff UI
  -> Backend POST /api/parking-sessions/upload?action=exit
  -> Upload middleware nhận ảnh
  -> AI service /detect
  -> Backend so plate vào/ra
  -> Backend tính vehicleMatchScore
  -> Nếu khớp: checkout + tính phí
  -> Nếu không khớp: giữ phiên, yêu cầu xác minh thủ công
  -> MongoDB cập nhật ParkingSession
```

### 3.5. Quy ước code cho nhân viên

- Không viết API mới trong `frontend/`.
- API mới phải đặt trong `backend/src/routes`.
- Logic nghiệp vụ không viết trực tiếp trong route.
- Controller chỉ điều phối request/response, không chứa logic dài.
- Logic dùng lại đặt trong `backend/src/services`.
- Schema MongoDB đặt trong `backend/src/models`.
- Validate input bằng `zod`.
- API lỗi phải trả JSON `{ message: string }`.
- Các file upload/runtime không commit lên GitHub.
- Không hardcode secret, tài khoản ngân hàng, SMTP password, Google secret trong code.

### 3.6. Gợi ý chia việc cho 5 người

Người 1 - Backend core:

- PricingConfig.
- Tính phí/phạt.
- Transaction.
- Role guard.

Người 2 - Frontend:

- Màn cấu hình giá.
- Màn thanh toán.
- Màn báo cáo.
- Màn xác minh thủ công OCR.

Người 3 - AI/camera:

- Test OCR ảnh thật.
- Cải thiện `ai-service/main.py`.
- Tích hợp RTSP snapshot.
- Crop vùng biển số.

Người 4 - Auth/payment:

- OTP email.
- Google OAuth.
- PayOS.
- Wallet/transaction history.

Người 5 - QA/tài liệu/báo cáo:

- Test case.
- Export PDF/Excel.
- Hướng dẫn setup A-Z.
- Sơ đồ use case, ERD, sequence cho báo cáo.

## 4. Cách chạy local

Yêu cầu máy có:

- Node.js.
- Python 3.
- MongoDB local ở `localhost:27017`.
- Tesseract OCR.

Chạy cài dependency:

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm run seed
```

Chạy backend MVC ở terminal 1:

```bash
npm run dev:backend
```

Chạy frontend ở terminal 2:

```bash
npm run dev:frontend
```

Chạy AI service ở terminal 3:

```bash
python3 -m venv .venv
.venv/bin/pip install -r ai-service/requirements.txt
npm run ai:dev
```

URL:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api`
- Backend health check: `http://localhost:4000/api/health`
- AI service: `http://127.0.0.1:5000`
- AI health check: `http://127.0.0.1:5000/health`

## 5. Biến môi trường

File env local không được push lên GitHub. Dự án có sẵn file mẫu:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

- Backend đọc biến từ `backend/.env`.
- Frontend đọc biến public từ `frontend/.env.local`.
- Google login cần thêm `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` trong `backend/.env`.
- Seed tạo bảng giá mẫu: miễn phí 20 phút, giá ngày 5.000đ, giá đêm 10.000đ, qua đêm 80.000đ, gói tháng 1.200.000đ, phạt quá hạn 20.000đ.

## 6. Tài khoản seed

Sau khi chạy `npm run seed`:

- Super Admin: `admin@ipark.vn` / `admin`
- Nhân viên cổng 1: `nv.1@ipark.vn` / `123456` - ca sáng `06:00-14:00`
- Nhân viên cổng 2: `nv.2@ipark.vn` / `123456` - ca chiều `14:00-22:00`
- Nhân viên cổng 3: `nv.3@ipark.vn` / `123456` - ca đêm `22:00-06:00`

## 7. Tiến độ

Ước tính hiện tại: khoảng 85%.

Đã làm thật:

- Đăng ký email/mật khẩu.
- Đăng nhập email/mật khẩu.
- Đăng xuất.
- JWT cookie `httpOnly`.
- Hash mật khẩu bằng `bcrypt`.
- MongoDB local bằng Mongoose.
- Seed Super Admin và 3 nhân viên iPARK.
- Seed bảng giá mẫu cho MVP.
- Phân quyền cơ bản admin/staff/customer.
- Quản lý user qua API admin.
- Quản lý phương tiện qua API.
- Chỉ nhận ô tô trong model/API chính.
- Tạo phiên đỗ xe bằng API.
- Hoàn thành phiên đỗ xe bằng API.
- Sức chứa 30 chỗ, chia khu A/B/C, mỗi khu 10 chỗ.
- Cấp slot tự động theo A/B/C.
- Miễn phí 20 phút đầu trong hàm tính phí.
- Cấu hình bảng giá trong MongoDB qua API/UI admin.
- Checkout lưu `feeBreakdown`: tổng phút, phút miễn phí, giờ tính tiền, đơn giá, phí gửi, phí phạt, tổng tiền.
- Upload ảnh xe vào.
- Python OCR nhận diện biển số ảnh vào.
- Lưu ảnh vào `backend/uploads/entry`.
- Upload ảnh xe ra.
- Python OCR nhận diện biển số ảnh ra.
- Match biển số vào/ra.
- Tính điểm tương đồng ảnh xe bằng fingerprint cơ bản.
- Lưu trạng thái match vào MongoDB.
- Nếu match thì checkout, nếu không khớp thì chờ admin duyệt.
- Admin duyệt checkout OCR không khớp có audit biển số/lý do/người duyệt.
- Checkout tạo giao dịch PayOS pending nếu phát sinh phí.
- Admin xác nhận thanh toán thủ công.
- Báo cáo summary theo ngày/khoảng ngày từ MongoDB.
- Export Excel/PDF phiên đỗ xe/doanh thu.
- Google OAuth login bằng JWT cookie khi có credentials.
- OTP email đặt lại mật khẩu.
- 2FA TOTP cho admin.
- Camera RTSP cấu hình DB, snapshot qua AI service, xe vào/ra bằng camera.
- Feedback, notification, shift, incident lưu MongoDB.
- UI dashboard, phiên đỗ xe, người dùng, phương tiện, ví, phản hồi, thông báo, ca làm, sự cố, AI, camera/thiết bị, cấu hình, báo cáo, bảo mật.

Đã có backend/UI thật cho đồ án local:

- Ví/lịch sử giao dịch, PayOS (webhook + reconcile chủ động khi chạy local).
- Tính phí theo ngày/đêm (trước 22h giá ngày, sau 22h giá đêm), cộng thêm ngày cho gửi qua đêm.
- Khách vãng lai: tra cứu biển số, trả phí trước qua QR PayOS, gia hạn thêm ngày.
- Gói thành viên (tháng/quý/năm): gửi xe miễn phí, không giới hạn xe, mọi biển số; cấp mã thành viên IPK-XXXXXX + QR.
- Mua/gia hạn/hủy gói; hủy gói vẫn dùng được tới hết hạn; chặn mua trùng khi còn gói hiệu lực.
- Nhập mã thành viên khi xe vào → phiên đánh dấu đã thanh toán, chỉ chờ checkout.
- Job dọn slot bị kẹt định kỳ (slot occupied mà không còn phiên đang gửi).
- Phản hồi khách hàng, thông báo, ca làm, sự cố.
- Camera/thiết bị RTSP với upload ảnh fallback.
- OTP email, 2FA admin, Google OAuth.
- Báo cáo Excel/PDF mẫu iPARK.

Chưa làm hoặc còn thiếu thông tin:

- Bảng giá mẫu đã có; admin cần chỉnh lại theo bảng giá thật.
- PayOS cần Client ID + API Key + Checksum Key. Local dùng nút "Kiểm tra thanh toán"; production cần webhook HTTPS.
- SMTP OTP cần SMTP host/user/app password thật để gửi email thật; thiếu SMTP thì API trả OTP demo.
- Google OAuth cần Google Client ID/Secret.
- Camera RTSP cần URL cổng vào/cổng ra thật; không có thì dùng upload ảnh fallback.
- AI nhận diện loại xe/màu xe production.
- AI match xe bằng model re-identification production.

## 8. API chính

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/2fa/setup`
- `POST /api/auth/2fa/verify`
- `POST /api/auth/2fa/disable`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Người dùng:

- `GET /api/users`
- `PATCH /api/users`

Phương tiện:

- `GET /api/vehicles`
- `POST /api/vehicles`
- `PATCH /api/vehicles`

Phiên đỗ xe:

- `GET /api/parking-sessions`
- `POST /api/parking-sessions`
- `PATCH /api/parking-sessions`
- `POST /api/parking-sessions/upload`
- `POST /api/parking-sessions/:id/verification-request`
- `POST /api/parking-sessions/:id/approve-checkout`
- `POST /api/parking-sessions/camera-entry`
- `POST /api/parking-sessions/camera-exit`

Cấu hình giá:

- `GET /api/pricing-config`
- `PATCH /api/pricing-config`

Báo cáo:

- `GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD&type=sessions|revenue&format=xlsx|pdf`

Thanh toán & ví:

- `GET /api/transactions`
- `POST /api/transactions/session/:sessionId` (tạo QR PayOS cho phiên)
- `POST /api/transactions/:id/confirm`
- `POST /api/payos/webhook` (PayOS gọi tự động)
- `GET /api/payos/return` (redirect sau thanh toán)

Gói thành viên:

- `GET /api/subscriptions/plans`
- `POST /api/subscriptions/plans` (admin)
- `PUT/DELETE /api/subscriptions/plans/:id` (admin)
- `GET /api/subscriptions/my`
- `POST /api/subscriptions` (mua gói → tạo QR PayOS)
- `POST /api/subscriptions/:id/renew` (gia hạn → tạo QR PayOS)
- `POST /api/subscriptions/:id/cancel`
- `GET /api/subscriptions/:id/payment-status` (kiểm tra & kích hoạt gói)

Public (không cần auth):

- `GET /api/public/availability` (chỗ trống realtime)
- `GET /api/public/lookup?plate=` (tra cứu phiên theo biển)
- `POST /api/public/calculate-fee-quick` (tính phí theo ngày + ca)
- `POST /api/public/pre-checkout` (chuẩn bị trả trước)
- `POST /api/public/extend-session` (gia hạn thêm ngày)
- `GET /api/public/session/:id/payment-status` (kiểm tra & reconcile thanh toán)

Thiết bị/camera:

- `GET /api/devices`
- `POST /api/devices`
- `PATCH /api/devices/:id`
- `POST /api/devices/:id/snapshot`

Vận hành:

- `GET/POST/PATCH /api/feedback`
- `GET/POST/PATCH /api/notifications`
- `GET/POST/PATCH /api/shifts`
- `GET/POST/PATCH /api/incidents`

AI service:

- `GET /health`
- `POST /detect`
- `POST /snapshot`

## 9. Luồng upload ảnh xe vào/ra

Xe vào:

1. UI gửi `FormData` tới `POST /api/parking-sessions/upload`.
2. `action=entry`.
3. Có file `image`.
4. Backend Express API gọi Python service `/detect`.
5. Python OCR trả `plate`, `confidence`, `rawText`, `imageHash`.
6. Backend lưu ảnh vào `backend/uploads/entry`.
7. Backend tạo `ParkingSession` trong MongoDB.
8. Slot được cấp theo A/B/C, tối đa 30 chỗ.

Xe ra:

1. UI chọn phiên đang gửi.
2. Upload ảnh xe ra.
3. UI gửi `FormData` tới `POST /api/parking-sessions/upload`.
4. `action=exit`.
5. Có `sessionId` và file `image`.
6. Python OCR nhận diện biển số ảnh ra.
7. API so biển số ảnh vào và ảnh ra.
8. API tính `vehicleMatchScore` từ image hash.
9. Nếu biển số khớp:
   - set `status=Đã hoàn thành`
   - set `checkOutAt`
   - tính `fee`
   - set `matchStatus=Khớp`
10. Nếu không khớp:
   - set `matchStatus=Không khớp`
   - không tự checkout
   - cần nhân viên xác minh thủ công.

## 10. Test đã chạy

Đã chạy:

```bash
npm run seed
npm run lint
npm run build
.venv/bin/python -m py_compile ai-service/main.py
curl http://127.0.0.1:5000/health
```

Đã test thủ công bằng ảnh biển số tự tạo:

- Python OCR đọc được `30H67890`.
- Confidence trả về `90`.
- Upload ảnh xe vào qua backend Express API tạo session MongoDB thành công.
- Upload ảnh xe ra cùng ảnh trả:
  - `matchStatus=Khớp`
  - `vehicleMatchScore=100`
  - `status=Đã hoàn thành`
  - `fee=0` nếu nằm trong 20 phút miễn phí.
  - `feeBreakdown` được lưu nếu checkout thành công.

Chưa test:

- Ảnh biển số thật từ camera/bãi xe.
- Ảnh mờ, nghiêng, thiếu sáng.
- Camera RTSP thật.
- Trường hợp biển vào và biển ra khác nhau bằng ảnh thật.
- Tải đồng thời nhiều xe.
- Quyền chi tiết cho từng role trên toàn bộ UI.
- Báo cáo PDF/Excel.
- Thanh toán PayOS thật.
- Email OTP thật.
- Google login end-to-end bằng credentials thật.
- Deploy production.

## 11. Đánh giá đúng yêu cầu Dũng

Đúng phần lõi:

- Upload ảnh lúc xe vào: đã có.
- Detect biển số lúc xe vào: đã có bằng Python OCR.
- Upload ảnh lúc checkout: đã có.
- Detect biển số lúc checkout: đã có.
- Match checkout với xe vào: đã có bằng biển số.
- Có thêm điểm match ảnh xe: đã có fingerprint ảnh cơ bản.
- Chỉ làm ô tô: đã cập nhật model/API/UI chính.
- Sức chứa 30 chỗ A/B/C: đã cập nhật config/slot.
- Miễn phí 20 phút đầu: đã cập nhật hàm tính phí.
- Bảng giá mẫu và chỉnh giá admin: đã có.
- Báo cáo summary/export Excel từ MongoDB: đã có.
- Google login: đã có code, cần Google credentials để test thật.

Chưa đúng 100% production:

- Bảng giá thật cần admin chỉnh lại từ bảng giá mẫu.
- Chưa có PayOS/SMTP/Google credentials thật.
- Chưa có URL RTSP camera thật.
- Chưa test ảnh thực tế.
- Chưa có model AI nhận dạng loại xe/màu xe production.

## 12. Roadmap để đạt 100%

Mốc hiện tại: khoảng 70%. Nhân viên tiếp nhận nên làm theo thứ tự dưới đây, không làm dàn trải.

### Giai đoạn 1 - Hoàn thiện nghiệp vụ tính tiền

Mục tiêu: hệ thống tính phí đúng theo quy định thật của iPARK.

Đã triển khai MVP:

- Model `PricingConfig` trong MongoDB.
- Seed bảng giá mẫu.
- API/UI admin để sửa bảng giá.
- Checkout dùng bảng giá DB và lưu `feeBreakdown`.
- Báo cáo summary/export Excel từ MongoDB.

Đầu vào cần có để chỉnh production:

- Giá ô tô thật theo giờ.
- Quy tắc qua đêm.
- Quy tắc gói tháng.
- Quy tắc phạt quá hạn.
- Có tính phí từ phút 21 hay tính lại từ đầu sau 20 phút miễn phí.

Tiêu chí xong:

- Gửi dưới 20 phút ra phí 0.
- Gửi trên 20 phút tính đúng theo bảng giá.
- Có phạt quá hạn nếu cấu hình phạt.
- Fee lưu vào MongoDB và hiển thị lại sau refresh.

Test cần chạy:

- Unit test hàm tính phí với các mốc 10 phút, 20 phút, 21 phút, 1 giờ, qua đêm.
- Manual test tạo phiên, checkout, refresh lại vẫn thấy phí đúng.

### Giai đoạn 2 - Hoàn thiện vận hành ảnh/OCR

Mục tiêu: luồng xe vào/ra dùng được với ảnh thực tế.

Đầu vào cần có:

- 10-20 ảnh xe vào/ra thật hoặc ảnh mẫu camera.
- Ảnh ban ngày, ban đêm, ảnh nghiêng, ảnh mờ.

Việc cần làm:

1. Test OCR trong `ai-service/main.py` bằng ảnh thật.
2. Tinh chỉnh tiền xử lý ảnh: grayscale, threshold, crop vùng biển số nếu cần.
3. Thêm trường sửa biển số thủ công khi OCR sai.
4. Lưu `manualPlate`, `verifiedBy`, `verifiedAt`, `verificationNote` vào MongoDB.
5. Nếu ảnh ra không khớp, không checkout tự động; yêu cầu nhân viên xác minh.
6. Thêm log lỗi OCR để biết ảnh nào nhận dạng kém.

Tiêu chí xong:

- Ảnh rõ nhận biển số ổn định.
- OCR sai vẫn có luồng sửa thủ công.
- Không có xe nào checkout nhầm khi biển không khớp.

Test cần chạy:

- Test ít nhất 20 ảnh thật.
- Test ảnh vào đúng/ra đúng.
- Test ảnh vào đúng/ra sai.
- Test ảnh mờ không đọc được.

### Giai đoạn 3 - Thanh toán PayOS và ví

Mục tiêu: thanh toán không còn là giao diện chờ cấu hình — webhook tự động xác nhận khi khách chuyển khoản.

Đầu vào cần có:

- PayOS Client ID, API Key, Checksum Key từ https://payos.vn.
- Webhook URL HTTPS (dùng ngrok để test local).
- Thông tin ngân hàng để hiển thị trên QR.

Việc cần làm:

1. Tạo model `Transaction`.
2. Tạo API tạo giao dịch thanh toán cho phiên đỗ xe.
3. Tạo payment link PayOS với số tiền và mô tả.
4. Lưu trạng thái: `pending`, `paid`, `failed`, `cancelled`.
5. PayOS gửi webhook tự động xác nhận thanh toán.
6. Nếu chưa có webhook, vẫn có QR cho khách chuyển khoản thủ công.
7. Trừ/nạp ví nếu dùng ví nội bộ.

Tiêu chí xong:

- Checkout tạo được payment link PayOS.
- QR hiển thị đúng số tiền/nội dung.
- Webhook nhận thì tự động xác nhận thanh toán.
- Lịch sử giao dịch lưu MongoDB.

### Giai đoạn 4 - OTP email và Google login

Mục tiêu: xác thực đầy đủ theo yêu cầu ban đầu.

Đầu vào cần có:

- SMTP host, port, email gửi, app password.
- Google OAuth Client ID/Secret.
- Redirect URL local: `http://localhost:4000/api/auth/google/callback`.

Việc cần làm OTP:

1. Tạo model `OtpToken`.
2. Tạo API gửi OTP quên mật khẩu.
3. Gửi email qua SMTP.
4. OTP hết hạn sau 5 phút.
5. API xác minh OTP và đặt lại mật khẩu.

Việc cần làm Google:

1. Thêm API bắt đầu OAuth.
2. Thêm callback OAuth.
3. Nếu email chưa có tài khoản, tạo user `customer` hoặc role theo cấu hình.
4. Set JWT cookie sau khi login Google thành công.

Tiêu chí xong:

- Gửi OTP tới email thật.
- OTP sai/hết hạn bị từ chối.
- Reset password dùng được.
- Google login tạo/đăng nhập user thành công.

### Giai đoạn 5 - Camera RTSP

Mục tiêu: có thể lấy ảnh từ 2 camera cổng vào/cổng ra.

Đầu vào cần có:

- RTSP/HTTP camera cổng vào.
- RTSP/HTTP camera cổng ra.
- Username/password camera nếu có.

Việc cần làm:

1. Tạo model `Device`.
2. Lưu cấu hình camera vào/ra.
3. Python service dùng OpenCV đọc frame từ RTSP.
4. API chụp snapshot từ camera.
5. Snapshot cổng vào gọi OCR và tạo phiên.
6. Snapshot cổng ra gọi OCR và checkout.
7. UI hiển thị trạng thái online/offline.

Tiêu chí xong:

- Camera online hiển thị OK.
- Chụp được ảnh từ cổng vào/cổng ra.
- Ảnh từ camera đi qua cùng OCR hiện tại.

### Giai đoạn 6 - Báo cáo

Mục tiêu: admin xuất được báo cáo phục vụ nộp đồ án.

Đầu vào cần có:

- Mẫu PDF/Excel nếu trường yêu cầu.
- Danh sách báo cáo bắt buộc.

Việc cần làm:

1. Báo cáo doanh thu theo ngày/tháng/khoảng thời gian.
2. Báo cáo lượt xe vào.
3. Báo cáo lượt xe ra.
4. Báo cáo xe đang gửi.
5. Báo cáo phí phạt.
6. Báo cáo giao dịch ví/thanh toán.
7. Xuất Excel trước, PDF sau.

Tiêu chí xong:

- Lọc được theo khoảng thời gian.
- Số liệu lấy từ MongoDB, không dùng mock.
- File export mở được và đúng format.

### Giai đoạn 7 - Role, bảo mật và hoàn thiện bàn giao

Mục tiêu: hệ thống đủ chắc để bàn giao local.

Việc cần làm:

1. Siết role guard cho từng API.
2. Ẩn menu UI theo role.
3. Super Admin quản lý nhân viên.
4. Nhân viên chỉ thao tác xe vào/ra, không sửa giá/doanh thu.
5. Đổi toàn bộ mật khẩu mặc định trước khi bàn giao.
6. Viết hướng dẫn cài MongoDB, Tesseract, Node, Python từ A-Z.
7. Thêm script kiểm tra sức khỏe hệ thống.

Tiêu chí xong:

- API bị gọi sai role trả 403.
- User chưa login không vào được dữ liệu.
- Hướng dẫn setup chạy được trên máy mới.

## 13. Definition of Done 100%

Dự án chỉ coi là 100% khi đạt toàn bộ điều kiện sau:

- `npm run lint` pass.
- `npm run build` pass.
- `npm run seed` pass trên MongoDB local sạch.
- AI service chạy được và `/health` trả `{ "ok": true }`.
- Login admin và 3 nhân viên iPARK thành công.
- Xe vào bằng ảnh thật tạo phiên đúng.
- Xe ra bằng ảnh thật match đúng và checkout đúng.
- OCR lỗi có luồng sửa biển số thủ công.
- Tính phí đúng bảng giá thật.
- Thanh toán PayOS webhook tự động xác nhận thanh toán thành công.
- OTP email gửi được email thật.
- Google login chạy được với OAuth credentials.
- Camera RTSP vào/ra lấy được snapshot hoặc tài liệu ghi rõ vẫn dùng upload ảnh nếu khách chưa có camera.
- Báo cáo doanh thu/lượt xe xuất được Excel hoặc PDF.
- Tài liệu setup A-Z đủ để nhân viên mới chạy lại trên máy khác.
- Không commit `.env.local`, mật khẩu, token, ảnh upload runtime.

## 14. Checklist test trước khi bàn giao

Auth:

- Login admin đúng mật khẩu.
- Login nhân viên đúng mật khẩu.
- Login sai mật khẩu bị từ chối.
- Logout xóa session.
- API chưa login trả 401.
- API sai role trả 403.

Parking:

- Tạo phiên bằng upload ảnh xe vào.
- Checkout bằng upload ảnh xe ra đúng biển.
- Checkout bằng ảnh sai biển không tự hoàn thành.
- OCR lỗi cho phép nhập biển thủ công.
- Bãi đủ 30 chỗ thì không cho tạo thêm phiên mới.
- Refresh trang không mất dữ liệu.

Pricing:

- Dưới 20 phút phí 0.
- Phút 21 tính đúng theo rule đã chốt.
- Qua đêm tính đúng.
- Phạt quá hạn tính đúng.
- Biên lai hiển thị breakdown đúng.

Payment:

- Tạo giao dịch đúng số tiền.
- QR đúng nội dung/PayOS.
- Webhook tự động xác nhận hoặc admin xác nhận thủ công nếu chưa có webhook.
- Xác nhận thanh toán đổi trạng thái giao dịch.
- Lịch sử giao dịch hiển thị đúng.

Reports:

- Lọc ngày có dữ liệu đúng.
- Lọc ngày không có dữ liệu không lỗi.
- Export Excel/PDF mở được.

AI/Camera:

- OCR ảnh rõ.
- OCR ảnh mờ.
- OCR ảnh nghiêng.
- Snapshot RTSP cổng vào.
- Snapshot RTSP cổng ra.

## 15. Thông tin cần hỏi tiếp Dũng

```text
Dũng ơi anh đã cập nhật iPARK: admin/3 nhân viên, chỉ ô tô, 30 chỗ khu A/B/C, miễn phí 20 phút đầu.
Em gửi tiếp giúp anh:

1. Bảng giá ô tô theo giờ, qua đêm, theo tháng.
2. Mức phạt quá hạn: quá bao lâu phạt, phạt bao nhiêu.
3. Ảnh xe vào/ra thực tế hoặc ảnh mẫu camera để test OCR.
4. PayOS credentials: Client ID, API Key, Checksum Key từ https://payos.vn.
5. PayOS Webhook URL (phải là HTTPS, dùng ngrok để test local nếu chưa deploy).
6. Thông tin ngân hàng để hiển thị trên QR (tên ngân hàng, BIN, số TK, tên TK).
7. SMTP test dùng email/app password nào?
8. Google Client ID/Secret test dùng project Google nào?
9. URL RTSP/HTTP của camera cổng vào và cổng ra.
10. Có mẫu báo cáo PDF/Excel của trường không?
```

## 16. Lưu ý bảo mật

- Không commit `.env.local`.
- Không commit ảnh upload runtime trong `backend/uploads`.
- Không commit `.venv`, `node_modules`, `.next`.
- Đổi `JWT_SECRET` khi deploy.
- Đổi mật khẩu seed trước khi bàn giao thật.
- Không để tài khoản ngân hàng, SMTP password, Google secret trong code.

## 17. Repo

- Branch chính: `main`.
- File tài liệu này được phép push để nhân viên đọc và tiếp tục phát triển.

# Function Details — Hệ thống iPARK (SEP490)

> Ánh xạ **8 chức năng vận hành** (theo mẫu Function Details) vào dự án **AI-Integrated Car Parking Management System (iPARK)**.  
> Liên kết Use Case: **UC01–UC27** (`docs/uc_data.py`).

---

## Bảng Function Details

| # | Function Details | Tên tiếng Việt | UC | Actor | Mô tả yêu cầu (iPARK) |
|---|------------------|----------------|-----|-------|------------------------|
| 1 | **View Vehicle Entry Queue** | Xem hàng đợi xe vào | UC13 | Staff | Staff xem danh sách xe đang chờ / vừa vào cổng: biển số, giờ vào, vị trí, độ tin cậy AI, trạng thái phiên `Đang gửi`. Dữ liệu tự cập nhật realtime từ camera AI và `ParkingSession`. |
| 2 | **View Vehicle Exit Queue** | Xem hàng đợi xe ra | UC13 | Staff | Staff xem danh sách xe sắp ra / đang chờ checkout: biển số, thời gian đỗ, phí tạm tính, trạng thái thanh toán. Hỗ trợ lọc theo biển số và duyệt ra bãi. |
| 3 | **Scan QR Ticket** | Quét mã QR thanh toán | UC04 | Guest, Staff | Khách hoặc staff quét mã QR (PayOS/VietQR) để thanh toán phí đỗ. Hệ thống tự đối soát trạng thái thanh toán và cập nhật phiên. |
| 4 | **Process Cash Payment** | Xử lý thanh toán tiền mặt | UC04, UC22 | Staff | Khi khách trả tiền mặt tại quầy, staff xác nhận số tiền; hệ thống ghi `method: cash`, cập nhật `Transaction` và mở barrier (UC03). |
| 5 | **Handle Parking Exceptions** | Xử lý ngoại lệ đỗ xe | UC14 | Staff | Xử lý khi AI không đọc được biển, không khớp phiên, bãi đầy, mất kết nối thiết bị, khiếu nại khẩn. Tạo incident, staff can thiệp và đóng sự cố. |
| 6 | **Auto Generate Parking Ticket** | Tự động sinh vé / phiên gửi xe | UC02 | Hệ thống | Khi xe vào cổng, AI nhận diện biển → hệ thống tự tạo `ParkingSession` (mã phiên, biển số, slot, giờ vào). Không cần staff nhập tay. |
| 7 | **Auto Generate QR Code** | Tự động sinh mã QR thanh toán | UC04 | Hệ thống | Khi checkout (UC03), hệ thống tự tính phí và sinh QR PayOS/VietQR động gắn với phiên. Khách quét để thanh toán. |
| 8 | **Auto Generate Invoice** | Tự động sinh hóa đơn / biên lai | UC04, UC03 | Hệ thống | Sau thanh toán thành công, hệ thống tự sinh biên lai điện tử (`invoiceNumber`, số tiền, phương thức, thời gian). Khách xem tại UC10. |

---

## Chi tiết yêu cầu từng chức năng

### FD01 — View Vehicle Entry Queue (Xem hàng đợi xe vào)

| Hạng mục | Nội dung |
|----------|----------|
| **UC cha** | UC13 — Giám sát hoạt động bãi đỗ |
| **Actor** | Staff |
| **Đầu vào** | Sự kiện camera cổng vào, phiên mới tạo (UC02) |
| **Đầu ra** | Bảng hàng đợi xe vào: biển số, slot, `checkInAt`, `entryConfidence`, trạng thái |
| **Luồng** | Staff mở dashboard vận hành → hệ thống aggregate phiên `Đang gửi` theo thời gian vào → refresh định kỳ → staff theo dõi, can thiệp UC14 nếu có cảnh báo |
| **Triển khai** | `frontend/src/features/overview/overview-view.tsx`, `sessions-view.tsx`; API `parking-sessions` |

---

### FD02 — View Vehicle Exit Queue (Xem hàng đợi xe ra)

| Hạng mục | Nội dung |
|----------|----------|
| **UC cha** | UC13 — Giám sát hoạt động bãi đỗ |
| **Actor** | Staff |
| **Đầu vào** | Xe đến cổng ra, phiên đang gửi, yêu cầu checkout |
| **Đầu ra** | Danh sách xe chờ ra: biển số, thời gian đỗ, phí tạm tính, `paymentStatus` |
| **Luồng** | Staff mở màn phiên đỗ → lọc phiên `Đang gửi` / chờ checkout → xem phí → thực hiện UC03/UC04 |
| **Triển khai** | `sessions-view.tsx` (checkout, approve); `public.controller.ts` tra cứu phiên theo biển |

---

### FD03 — Scan QR Ticket (Quét mã QR thanh toán)

| Hạng mục | Nội dung |
|----------|----------|
| **UC cha** | UC04 — Thanh toán phí đỗ xe |
| **Actor** | Guest, Staff |
| **Đầu vào** | Mã QR PayOS/VietQR gắn phiên hoặc giao dịch |
| **Đầu ra** | Trạng thái thanh toán `paid`; phiên được phép ra (UC03) |
| **Luồng** | Hệ thống sinh QR (FD07) → khách quét bằng app ngân hàng → PayOS webhook xác nhận → cập nhật `Transaction` và `ParkingSession` |
| **Triển khai** | `payos.service.ts`, `payos-webhook.service.ts`; `wallet-view.tsx` (modal QR); `public.controller.ts` |

---

### FD04 — Process Cash Payment (Xử lý thanh toán tiền mặt)

| Hạng mục | Nội dung |
|----------|----------|
| **UC cha** | UC04 — Thanh toán phí đỗ xe; UC22 — Quản lý giao dịch (admin đối soát) |
| **Actor** | Staff |
| **Đầu vào** | Phiên checkout, số tiền phí, xác nhận staff |
| **Đầu ra** | `Transaction` method `cash`, `paymentStatus: paid`, barrier mở |
| **Luồng** | Staff xem phí tại hàng đợi ra (FD02) → nhận tiền mặt → xác nhận trên hệ thống → ghi giao dịch → mở cổng |
| **Triển khai** | `Transaction` model (`method: cash`); `transactions.controller.ts` (`confirmTransaction`); seed mẫu giao dịch tiền mặt |

---

### FD05 — Handle Parking Exceptions (Xử lý ngoại lệ đỗ xe)

| Hạng mục | Nội dung |
|----------|----------|
| **UC cha** | UC14 — Xử lý sự cố vận hành |
| **Actor** | Staff |
| **Đầu vào** | AI lỗi, không khớp biển/phiên, bãi đầy, mất kết nối camera, khiếu nại |
| **Đầu ra** | Incident được xử lý; vận hành tự động trở lại |
| **Luồng** | Hệ thống tự tạo incident → staff nhận cảnh báo (UC13) → xử lý thủ công (nhập biển, khởi động thiết bị…) → đóng incident → leo thang UC24 nếu cần |
| **Triển khai** | `incidents-view.tsx`; UC02/UC03 exception flows; `recognition-logs` |

---

### FD06 — Auto Generate Parking Ticket (Tự động sinh vé / phiên gửi xe)

| Hạng mục | Nội dung |
|----------|----------|
| **UC cha** | UC02 — Gửi xe vào bãi |
| **Actor** | Hệ thống (AI + Backend) |
| **Đầu vào** | Ảnh/biển số từ camera cổng vào |
| **Đầu ra** | `ParkingSession` mới: mã phiên, biển số, slot, `checkInAt`, trạng thái `Đang gửi` |
| **Luồng** | Camera AI nhận diện biển → kiểm tra sức chứa → cấp slot (UC21) → tạo phiên → mở barrier → gửi thông báo (UC11) |
| **Triển khai** | `parkingSessions.controller.ts`; `cameraStream.service.ts`; `recognitionLog.service.ts` |

---

### FD07 — Auto Generate QR Code (Tự động sinh mã QR thanh toán)

| Hạng mục | Nội dung |
|----------|----------|
| **UC cha** | UC04 — Thanh toán phí đỗ xe |
| **Actor** | Hệ thống |
| **Đầu vào** | Phiên checkout, phí đã tính theo UC18 |
| **Đầu ra** | Mã QR PayOS/VietQR, `orderCode`, link thanh toán |
| **Luồng** | UC03 kích hoạt tính phí → gọi PayOS API → trả QR cho khách → poll/webhook xác nhận (FD03) |
| **Triển khai** | `payos.service.ts`; `public.controller.ts`; `transactions.controller.ts`; `wallet-view.tsx` |

---

### FD08 — Auto Generate Invoice (Tự động sinh hóa đơn / biên lai)

| Hạng mục | Nội dung |
|----------|----------|
| **UC cha** | UC04 — Thanh toán; UC03 — Lấy xe ra (gửi biên lai) |
| **Actor** | Hệ thống |
| **Đầu vào** | Giao dịch thanh toán thành công |
| **Đầu ra** | Biên lai điện tử: `invoiceNumber`, biển số, số tiền, phương thức, thời gian |
| **Luồng** | Thanh toán `paid` → hệ thống sinh `invoiceNumber` → lưu `Transaction` → khách tải/xem tại UC10; gửi thông báo UC11 |
| **Triển khai** | `Transaction.invoiceNumber`; `wallet-view.tsx` (lịch sử GD); UC03 postcondition biên lai điện tử |

---

## Ma trận Function Details ↔ Use Case

| Function | UC02 | UC03 | UC04 | UC10 | UC13 | UC14 | UC22 |
|----------|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
| FD01 Entry Queue | | | | | ✓ | | |
| FD02 Exit Queue | | ✓ | | | ✓ | | |
| FD03 Scan QR | | | ✓ | | | | |
| FD04 Cash Payment | | | ✓ | | | | ✓ |
| FD05 Exceptions | ✓ | ✓ | | | ✓ | ✓ | |
| FD06 Auto Ticket | ✓ | | | | | | |
| FD07 Auto QR | | ✓ | ✓ | | | | |
| FD08 Auto Invoice | | ✓ | ✓ | ✓ | | | |

---

## Ghi chú SEP490

- Hệ thống iPARK ưu tiên **tự động hóa** (FD06, FD07, FD08); staff chỉ can thiệp khi ngoại lệ (FD04, FD05) hoặc giám sát hàng đợi (FD01, FD02).
- Thanh toán chính: **PayOS/VietQR** (FD03, FD07); tiền mặt (FD04) là phương án dự phòng khi khách không quét QR.
- Các function này bổ sung cho **27 UC** — không thay thế UC, mà mô tả **chi tiết chức năng màn hình / nghiệp vụ** phục vụ báo cáo SRS và demo.

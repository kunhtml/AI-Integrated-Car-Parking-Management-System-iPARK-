import type {
  DemoUser,
  DeviceItem,
  ParkingSession,
  PricingConfig,
  PaymentConfig,
  RegisteredVehicle,
  ShiftItem,
} from "@/types";

export const demoUsers: DemoUser[] = [
  {
    id: 1,
    name: "Super Admin iPARK",
    email: "admin@ipark.vn",
    password: "admin",
    role: "admin",
    status: "Đang hoạt động",
    wallet: 0,
  },
  {
    id: 2,
    name: "Nhân viên cổng 1",
    email: "nv.1@ipark.vn",
    password: "123456",
    role: "staff",
    status: "Đang hoạt động",
    wallet: 0,
  },
  {
    id: 3,
    name: "Nhân viên cổng 2",
    email: "nv.2@ipark.vn",
    password: "123456",
    role: "staff",
    status: "Đang hoạt động",
    wallet: 0,
  },
];

export const initialSessions: ParkingSession[] = [
  {
    id: "PX-1028",
    plate: "30H-678.90",
    owner: "Nguyễn Minh Anh",
    vehicleType: "Ô tô",
    checkIn: "08:15",
    slot: "A-12",
    status: "Đang gửi",
    fee: 0,
    entryDetectedPlate: "30H67890",
    entryConfidence: 96,
    matchStatus: "Chưa checkout",
  },
  {
    id: "PX-1027",
    plate: "30E-345.67",
    owner: "Khách iPARK 03",
    vehicleType: "Ô tô",
    checkIn: "07:40",
    checkOut: "10:20",
    slot: "B-04",
    status: "Đã hoàn thành",
    fee: 0,
    entryDetectedPlate: "30E34567",
    exitDetectedPlate: "30E34567",
    entryConfidence: 93,
    exitConfidence: 91,
    vehicleMatchScore: 100,
    matchStatus: "Khớp",
  },
  {
    id: "PX-1026",
    plate: "30F-222.11",
    owner: "Lê Thu Hà",
    vehicleType: "Ô tô",
    checkIn: "09:05",
    slot: "A-08",
    status: "Đang gửi",
    fee: 0,
    entryDetectedPlate: "30F22211",
    entryConfidence: 89,
    matchStatus: "Chưa checkout",
  },
];

export const initialVehicles: RegisteredVehicle[] = [
  { plate: "30H-678.90", owner: "Nguyễn Minh Anh", type: "Ô tô", status: "Đã đăng ký" },
  { plate: "30E-345.67", owner: "Trần Hoàng Nam", type: "Ô tô", status: "Đã đăng ký" },
  { plate: "30F-222.11", owner: "Lê Thu Hà", type: "Ô tô", status: "Cần duyệt" },
  { plate: "30K-999.99", owner: "Khách vi phạm", type: "Ô tô", status: "Blacklist" },
];

export const transactions = [
  { id: "GD-1201", method: "Ví nội bộ", amount: 18000, status: "Thành công", time: "10:22" },
  { id: "GD-1200", method: "VietQR chờ cấu hình", amount: 100000, status: "Chờ xác nhận", time: "09:40" },
  { id: "GD-1199", method: "Nạp ví", amount: 250000, status: "Thành công", time: "Hôm qua" },
];

export const notifications = [
  "Xe 30H-678.90 vừa vào bãi.",
  "Số dư ví dưới ngưỡng cảnh báo.",
  "Camera cổng B mất tín hiệu 2 phút.",
  "Khuyến mãi gói gửi xe tháng đang chờ duyệt.",
];

export const aiQueue = [
  { plate: "30H-678.90", confidence: "96%", type: "Ô tô", color: "Trắng", issue: "Không lỗi" },
  { plate: "30E-345.67", confidence: "72%", type: "Ô tô", color: "Đen", issue: "Ảnh hơi mờ" },
  { plate: "30K-999.99", confidence: "61%", type: "Ô tô", color: "Xám", issue: "Nghi trùng biển" },
];

export const devices = [
  { name: "Camera cổng vào", status: "Chờ RTSP", lastShot: "Chưa có", roi: "Biển số trước" },
  { name: "Camera cổng ra", status: "Chờ RTSP", lastShot: "Chưa có", roi: "Biển số sau" },
];

export const shiftRows = [
  { name: "Ca sáng", staff: "nv.1@ipark.vn", time: "06:00 - 14:00", status: "Đang làm" },
  { name: "Ca chiều", staff: "nv.2@ipark.vn", time: "14:00 - 22:00", status: "Chưa bắt đầu" },
  { name: "Ca đêm", staff: "nv.3@ipark.vn", time: "22:00 - 06:00", status: "Chưa bắt đầu" },
];

export const initialPricingConfig: PricingConfig = {
  id: "default",
  freeMinutes: 20,
  hourlyRate: 10000,
  overnightRate: 80000,
  monthlyRate: 1200000,
  overdueFineRate: 20000,
  isActive: true,
};

export const initialPaymentConfig: PaymentConfig = {
  id: "default",
  bankName: "Ngân hàng test",
  bankBin: "970436",
  accountNumber: "0000000000",
  accountName: "IPARK",
  transferPrefix: "IPARK",
};

export function fallbackDevices(): DeviceItem[] {
  return devices.map((item, index) => ({
    id: String(index),
    name: item.name,
    gate: index === 0 ? "entry" : "exit",
    rtspUrl: "",
    status: "unknown",
    lastSnapshotUrl: "",
    roiNote: item.roi,
  }));
}

export function fallbackShifts(): ShiftItem[] {
  return shiftRows.map((item, index) => ({
    id: String(index),
    name: item.name,
    startAt: item.time,
    endAt: "",
    status: item.status === "Đang làm" ? "Đang làm" : "Đã kết thúc",
  }));
}

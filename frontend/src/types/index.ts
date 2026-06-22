export type Role = "admin" | "staff" | "customer";

export type View =
  | "overview"
  | "sessions"
  | "users"
  | "pricing"
  | "reports"
  | "profile"
  | "wallet"
  | "vehicles"
  | "feedback"
  | "notifications"
  | "shifts"
  | "incidents"
  | "ai"
  | "devices"
  | "security"
  | "zones";

export type DemoUser = {
  id: number | string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  status: "Đang hoạt động" | "Đã khóa";
  wallet: number;
  avatarUrl?: string;
  provider?: string;
  twoFactorEnabled?: boolean;
};

export type FeeBreakdown = {
  totalMinutes: number;
  freeMinutes: number;
  billableMinutes: number;
  billableHours: number;
  hourlyRate: number;
  parkingFee: number;
  overdueFine: number;
  totalFee: number;
};

export type ParkingSession = {
  id: string;
  plate: string;
  owner: string;
  vehicleType: "Ô tô";
  checkIn: string;
  checkOut?: string;
  slot: string;
  status: "Đang gửi" | "Đã hoàn thành";
  fee: number;
  entryImageUrl?: string;
  exitImageUrl?: string;
  entryDetectedPlate?: string;
  exitDetectedPlate?: string;
  entryConfidence?: number;
  exitConfidence?: number;
  vehicleMatchScore?: number;
  matchStatus?: "Chưa checkout" | "Khớp" | "Không khớp";
  verificationStatus?: "Không cần" | "Chờ duyệt" | "Đã duyệt" | "Từ chối";
  manualPlate?: string;
  verificationNote?: string;
  paymentStatus?: "unpaid" | "pending" | "paid";
  transactionId?: string;
  feeBreakdown?: FeeBreakdown;
};

export type RegisteredVehicle = {
  id?: string;
  plate: string;
  owner: string;
  type: "Ô tô" | string;
  status: "Đã đăng ký" | "Cần duyệt" | "Blacklist" | string;
};

export type PricingConfig = {
  id: string;
  freeMinutes: number;
  hourlyRate: number;
  overnightRate: number;
  monthlyRate: number;
  overdueFineRate: number;
  isActive: boolean;
  updatedAt?: string;
};

export type ReportSummary = {
  from: string;
  to: string;
  entryCount: number;
  exitCount: number;
  activeCount: number;
  revenue: number;
  freeSessionCount: number;
  paidSessionCount: number;
};

export type PaymentConfig = {
  id: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  transferPrefix: string;
};

export type TransactionItem = {
  id: string;
  sessionId?: string;
  method: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  content: string;
  qrUrl?: string;
  paidAt?: string;
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
};

export type FeedbackItem = {
  id: string;
  subject: string;
  content: string;
  status: "Đang xử lý" | "Đã phản hồi" | "Đã đóng";
  response?: string;
  createdAt: string;
};

export type DeviceItem = {
  id: string;
  name: string;
  gate: "entry" | "exit";
  rtspUrl: string;
  username?: string;
  roiNote?: string;
  status: "online" | "offline" | "unknown";
  lastSnapshotUrl?: string;
};

export type ShiftItem = {
  id: string;
  name: string;
  startAt: string;
  endAt?: string;
  status: "Đang làm" | "Đã kết thúc";
  note?: string;
};

export type IncidentItem = {
  id: string;
  type: string;
  note: string;
  plate?: string;
  status: "Mới" | "Đang xử lý" | "Đã xử lý";
  createdAt: string;
};

export type AuthMode = "login" | "register" | "forgot";

export type Zone = {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  allowedVehicleTypes: string[];
  displayOrder: number;
  isActive: boolean;
  stats?: {
    total: number;
    empty: number;
    occupied: number;
  };
};

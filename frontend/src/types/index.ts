export type Role = "admin" | "staff" | "customer";

export type View =
  | "overview"
  | "sessions"
  | "users"
  | "pricing"
  | "reports"
  | "membershipPackages"
  | "parkingFeeRules"
  | "revenueReports"
  | "staffAccounts"
  | "changePassword"
  | "profile"
  | "wallet"
  | "vehicles"
  | "feedback"
  | "notifications"
  | "shifts"
  | "incidents"
  | "ai"
  | "recognitionLogs"
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
  paymentStatus?: "unpaid" | "pending" | "paid" | "fully_paid" | "partial_paid";
  transactionId?: string;
  feeBreakdown?: FeeBreakdown;
  ownerEmail?: string;
  paidAmount?: number;
  checkInDate?: string;
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
  payosCheckoutUrl?: string;
  sessionFee?: number;
  sessionPaidAmount?: number;
  sessionPaymentStatus?: string;
  plate?: string;
  ownerName?: string;
  ownerEmail?: string;
  slot?: string;
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
  httpUrl?: string;
  username?: string;
  deviceType?: "rtsp" | "http" | "onvif" | "usb";
  roiNote?: string;
  roi?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    label?: string;
  } | null;
  streamPath?: string;
  status: "online" | "offline" | "unknown";
  lastSnapshotUrl?: string;
};

export type RecognitionLogItem = {
  id: string;
  action: "entry" | "exit" | "camera-entry" | "camera-exit" | "manual";
  source: "upload" | "camera";
  status: "success" | "failed" | "mismatch" | "pending-verification";
  plate?: string;
  detectedPlate?: string;
  confidence?: number;
  rawText?: string;
  imageHash?: string;
  imageUrl?: string;
  vehicleType?: string;
  sessionId?: string;
  deviceId?: string;
  deviceName?: string;
  matched?: boolean;
  matchStatus?: "Chưa checkout" | "Khớp" | "Không khớp";
  vehicleMatchScore?: number;
  message?: string;
  createdBy?: string;
  createdAt: string;
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

export type RevenueChartPoint = {
  date: string;
  revenue: number;
  count: number;
};

export type OccupancyHourPoint = {
  hour: number;
  avgOccupancy: number;
  maxOccupancy: number;
};

export type TopCustomer = {
  userId: string;
  name: string;
  email?: string;
  sessionCount: number;
  totalSpent: number;
};

export type PeakHourPoint = {
  dayOfWeek: number;
  hour: number;
  count: number;
};

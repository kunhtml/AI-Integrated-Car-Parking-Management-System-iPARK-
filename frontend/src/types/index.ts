export type Role = "admin" | "staff" | "customer";
export type AuthMode = "login" | "register" | "forgot";

export type View =
  | "overview"
  | "sessions"
  | "users"
  | "pricing"
  | "reports"
  | "subscriptions"
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
  | "devices"
  | "security"
  | "systemProcess"
  | "zones";

export type DemoUser = {
  id: number | string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  status: "Đang hoạt động" | "Đã khóa" | string;
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
  vehicleType: "Ô tô" | string;
  rfidUid?: string;
  checkIn: string;
  checkOut?: string;
  slot: string;
  status: "Đang gửi" | "Đã hoàn thành" | string;
  fee: number;
  paidAmount?: number;
  isMember?: boolean;
  paymentMethod?: "cash" | "payos" | "vietqr" | "wallet" | "subscription";
  subscriptionId?: string;
  memberCode?: string;
  subscriptionPlanName?: string;
  paymentLookupCode?: string;
  qrCode?: string;
  entryImageUrl?: string;
  exitImageUrl?: string;
  entryDetectedPlate?: string;
  exitDetectedPlate?: string;
  entryConfidence?: number;
  exitConfidence?: number;
  vehicleMatchScore?: number;
  matchStatus?: "Chưa checkout" | "Khớp" | "Không khớp" | string;
  verificationStatus?: "Không cần" | "Chờ duyệt" | "Đã duyệt" | "Từ chối" | string;
  manualPlate?: string;
  verificationNote?: string;
  feeBreakdown?: FeeBreakdown;
  transactionId?: string;
  paymentStatus?: "unpaid" | "pending" | "paid" | "failed" | "partial_paid" | "fully_paid";
  createdAt?: string;
};

export type ParkingZone = {
  id: string;
  name: string;
  description: string;
  capacity: number;
  allowedVehicleTypes: string[];
  displayOrder: number;
  isActive: boolean;
  stats: {
    total: number;
    empty: number;
    occupied: number;
  };
};

export type Vehicle = {
  id: string;
  plate: string;
  owner: string;
  type: string;
  status: "Đang hoạt động" | "Đã khóa" | string;
};

export type PricingConfig = {
  id: string;
  freeMinutes: number;
  hourlyRate: number;
  overnightRate: number;
  monthlyRate: number;
  overdueFineRate: number;
  dailyMaxRate: number;
  graceExitMinutes: number;
  effectiveFrom: string;
  isActive: boolean;
  updatedAt?: string | null;
};

export type PaymentConfig = {
  id: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  transferPrefix: string;
  isActive: boolean;
};

export type TransactionItem = {
  id: string;
  sessionId: string;
  userId?: string;
  method?: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  content?: string;
  qrUrl?: string;
  paidAt?: string;
  note?: string;
  createdAt?: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  targetRole?: Role;
  isRead?: boolean;
  createdAt?: string;
};

export type FeedbackItem = {
  id: string;
  subject: string;
  content: string;
  status: string;
  response?: string;
  createdAt?: string;
};

export type DeviceItem = {
  id: string;
  name: string;
  gate: "entry" | "exit";
  status: string;
  lastSnapshotUrl?: string;
  lastSnapshotAt?: string;
};

export type ShiftItem = {
  id: string;
  name: string;
  note?: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
};

export type IncidentItem = {
  id: string;
  type: string;
  note?: string;
  plate?: string;
  status: string;
  createdAt?: string;
};

export type RegisteredVehicle = {
  id: string;
  plate: string;
  owner: string;
  type: string;
  status: string;
};

export type ReportSummary = {
  totalSessions: number;
  revenue: number;
  activeSessions: number;
  averageFee: number;
};

export type Zone = ParkingZone;

export type RevenueChartPoint = {
  label: string;
  revenue: number;
  sessions?: number;
};

export type OccupancyHourPoint = {
  hour: string;
  occupied: number;
  available?: number;
};

export type TopCustomer = {
  name: string;
  plate?: string;
  sessions: number;
  revenue: number;
};

export type PeakHourPoint = {
  hour: string;
  sessions: number;
};

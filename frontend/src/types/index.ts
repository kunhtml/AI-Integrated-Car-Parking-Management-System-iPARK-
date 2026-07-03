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
  matchStatus?: "Khớp" | "Không khớp";
  verificationStatus?: "Không cần" | "Chờ duyệt" | "Đã duyệt";
  manualPlate?: string;
  verificationNote?: string;
  feeBreakdown?: FeeBreakdown;
  transactionId?: string;
  paymentStatus?: "pending" | "paid" | "failed";
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
  status: "Đang hoạt động" | "Đã khóa";
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

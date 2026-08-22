export type StaffGate = "entry" | "exit";

export type RfidCardStatus = "active" | "inactive" | "available" | "pending-sale" | "in-use" | "lost" | "blocked" | "damaged" | "returned";
export type RfidCard = { id: string; uid: string; cardId?: string; ownerName?: string; plate?: string; userType?: "resident" | "guest"; cardType?: "member" | "guest"; status: RfidCardStatus; notes?: string; createdAt?: string; updatedAt?: string; issuedAt?: string | null; lastUsedAt?: string | null; lostAt?: string | null; blockedAt?: string | null; blockedReason?: string | null; };
export type RfidScanLog = { id: string; cardId?: string; action: string; status?: string; failureReason?: string; plateDetected?: string; createdAt?: string; performedBy?: string; };

export type InvoiceItem = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string | null;
  total?: number;
  status: "Draft" | "Issued" | "Paid" | "Cancelled" | string;
  createdAt: string;
};

export type Role = "admin" | "staff" | "customer";
export type ViewAsMode = "staff" | "customer";

export type View =
  | "overview"
  | "sessions"
  | "users"
  | "pricing"
  | "reports"
  | "profile"
  | "wallet"
  | "vehicles"
  | "notifications"
  | "shifts"
  | "incidents"
  | "ai"
  | "occupancy"
  | "devices"
  | "zones"
  | "parking-slots"
  | "reservations"
  | "subscriptions"
  | "rfid-registration"
  | "penalties"
  | "rfid"
  | "camera-logs"
  | "cameras"
  | "staff-desk"
  | "disputes"
  | "capacity-config"
  | "staff-applications";

export type DemoUser = {
  id: number | string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  gate?: StaffGate;
  status: "Đang hoạt động" | "Đã khóa";
  avatarUrl?: string | null;
  provider?: string;
  twoFactorEnabled?: boolean;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  idCardNumber?: string | null;
  idCardIssuedAt?: string | null;
  idCardExpiry?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  company?: string | null;
  taxCode?: string | null;
  isVerified?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  dailyBreakdown?: DailyBreakdownItem[];
  subscriptionDiscount?: number;
  subscriptionWarn?: string;
};

export type DailyRateType = "day" | "night";
export type DailyBreakdownItem = {
  dayIndex: number;
  date: string;
  rateType: DailyRateType;
  fee: number;
  checkOutHour: number;
};

export type ParkingSession = {
  id: string;
  plate: string;
  owner: string;
  vehicleType: "Ô tô";
  checkIn: string;
  checkInDate: string;
  checkInAt?: string;
  checkOut?: string;
  checkOutDate?: string;
  expectedCheckOut?: string;
  prepaidCheckoutAt?: string;
  slot: string;
  slotId?: string;
  status: "Đang gửi" | "Đã hoàn thành" | "Đã hủy" | "Chờ thanh toán" | "Hủy";
  paymentStatus?: "unpaid" | "partial_paid" | "fully_paid";
  paymentMethod?: string;
  fee: number;
  paidAmount?: number;
  dailyBreakdown?: DailyBreakdownItem[];
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
  entrySource?: "camera" | "manual";
  exitSource?: "camera" | "manual";
  manualEntryReason?: string;
  manualExitReason?: string;
  exitRfidManualVerified?: boolean;
  entryRfidUid?: string;
  expectedExitRfidUid?: string;
  exitRfidUid?: string;
  rfidCardId?: string;
  transactionId?: string;
  ownerEmail?: string;
  feeBreakdown?: FeeBreakdown;
};

export type RegisteredVehicle = {
  id: string;
  plate: string;
  owner: string;
  ownerPhone?: string | null;
  ownerAddress?: string | null;
  type: "Ô tô" | string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  engineNo?: string | null;
  chassisNo?: string | null;
  status: "Đã đăng ký" | "Cần duyệt" | "Blacklist" | string;
  rejectionReason?: string | null;
  userId?: string | null;
  isCompanyVehicle?: boolean;
  user?: {
    name?: string;
    email?: string;
    phone?: string | null;
  } | null;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleRequest = {
  id: string;
  vehicleId: string;
  subscriptionId: string;
  type: "edit" | "delete";
  status: "pending" | "approved" | "rejected";
  requestedChanges?: {
    plate?: string;
    ownerName?: string;
    ownerPhone?: string;
    ownerAddress?: string;
    brand?: string;
    model?: string;
    color?: string;
    year?: number;
    engineNo?: string;
    chassisNo?: string;
    status?: string;
  };
  reason?: string;
  adminNote?: string;
  resolvedAt?: string;
  vehicle?: RegisteredVehicle;
  user?: {
    name?: string;
    email?: string;
    phone?: string | null;
  };
  subscription?: { id: string };
  createdAt: string;
  updatedAt?: string;
};

export type PricingConfig = {
  id: string;
  dayRate: number;
  rfidCardSalePrice?: number;
  nightRate: number;
  dayStartHour: number;
  nightStartHour: number;
  gracePeriod?: number;
  maxMinutes?: number;
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
  payosEnabled?: boolean;
};

export type PayOSPaymentData = {
  qrCode: string;
  checkoutUrl: string;
  orderCode: string;
  amount: number;
  accountNumber?: string;
  accountName?: string;
  bin?: string;
  description?: string;
};

export type TransactionItem = {
  id: string;
  sessionId?: string;
  subscriptionId?: string;
  method: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  content?: string;
  qrUrl?: string;
  payosQrCode?: string;
  payosCheckoutUrl?: string;
  payosOrderCode?: string;
  gateway?: string;
  paidAt?: string;
  createdAt: string;
  // Extension tracking
  extensionId?: string;
  extensionType?: "initial" | "extend" | "overtime" | "adjustment";
  previousFee?: number;
  newFee?: number;
  // Session info
  plate?: string;
  ownerName?: string;
  ownerEmail?: string;
  slot?: string;
  sessionPaymentStatus?: "unpaid" | "partial_paid" | "fully_paid";
  sessionFee?: number;
  sessionPaidAmount?: number;
};

export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
};

export type RecognitionLogItem = {
  id: string;
  deviceId?: string;
  deviceName?: string;
  gate?: "entry" | "exit" | "in" | "out";
  action: "entry" | "exit" | "camera-entry" | "camera-exit" | "manual";
  source: "upload" | "camera";
  detectedPlate?: string;
  plate?: string;
  confidence?: number | null;
  status: "success" | "failed" | "mismatch" | "pending-verification" | string;
  message?: string;
  rawText?: string;
  createdAt: string;
  imageUrl?: string;
};

export type DeviceItem = {
  id: string;
  name: string;
  gate: "entry" | "exit";
  lane?: "in" | "out";
  rtspUrl: string;
  httpUrl?: string;
  deviceType?: string;
  username?: string;
  roiNote?: string;
  status: "online" | "offline" | "unknown";
  lastSnapshotUrl?: string;
  healthCheckEnabled?: boolean;
  offlineThresholdMinutes?: number;
  maintenanceSchedule?: {
    intervalDays: number;
    lastMaintenanceAt?: string;
    nextMaintenanceAt?: string;
  };
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
  } | null;
};

export type ShiftItem = {
  id: string;
  name: string;
  startAt: string;
  endAt?: string;
  status: "Đang làm" | "Đã kết thúc";
  note?: string;
};

export type ShiftScheduleItem = {
  id: string;
  staffId: string;
  staffName?: string;
  staffEmail?: string;
  staffPhone?: string | null;
  staffAvatarUrl?: string | null;
  date: string;
  shiftType: "morning" | "afternoon" | "evening" | "night";
  startTime: string;
  endTime: string;
  status: "scheduled" | "checked_in" | "completed" | "cancelled";
  assignedBy?: string;
  assignedByName?: string;
  note?: string;
  location?: string;
  deviceId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ShiftType = {
  key: string;
  label: string;
  startTime: string;
  endTime: string;
};

export type StaffForSchedule = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
};

export type IncidentItem = {
  id: string;
  type: string;
  note: string;
  plate?: string;
  sessionId?: string;
  disputeId?: string;
  status: "Mới" | "Đang xử lý" | "Đã xử lý";
  createdAt: string;
};

export type DisputeStatus = "Mới" | "Đang xử lý" | "Đã xử lý" | "Từ chối";

export type DisputeMessage = {
  id: string;
  senderId: string;
  senderRole: "customer" | "admin" | "staff";
  senderName: string;
  content: string;
  createdAt: string;
};

export type DisputeItem = {
  id: string;
  code: string;
  userId?: string;
  sessionId?: string;
  transactionId?: string;
  plate?: string;
  reason: string;
  content: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  attachments: string[];
  status: DisputeStatus;
  incidentId?: string;
  resolutionNote?: string;
  handledBy?: string;
  handledAt?: string | null;
  messages: DisputeMessage[];
  createdAt: string;
  updatedAt: string;
};

export type DisputeSessionRef = {
  id: string;
  plate: string;
  slot: string;
  status: string;
  fee: number;
  checkInAt: string;
  checkOutAt: string | null;
};

export type DisputeTransactionRef = {
  id: string;
  sessionId?: string;
  plate?: string;
  method: string;
  amount: number;
  status: string;
  createdAt: string;
};

export type AuthMode =
  | "login"
  | "register"
  | "forgot"
  | "verify-register"
  | "verify-login"
  | "verify-forgot"
  | "verify-2fa";

export type ZoneStats = {
  total: number;
  empty: number;
  occupied: number;
  reserved: number;
  maintenance: number;
};

export type Zone = {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  walkInQuota: number;
  subscriberQuota: number;
  allowedVehicleTypes: string[];
  pricingConfigId?: string;
  displayOrder: number;
  isActive: boolean;
  stats?: ZoneStats;
  updatedAt?: string;
};

export type SlotStatus = "empty" | "occupied" | "reserved" | "maintenance";
export type SlotType = "regular" | "VIP" | "electric" | "handicap";
// "resident" = chỉ dành cho cư dân. "guest" = chỉ dành cho khách vãng lai.
// "shared" = ưu tiên cư dân, khi rảnh khách vãng lai vẫn đậu được.
export type SlotAccessPolicy = "resident" | "guest" | "shared";

export type ParkingSlot = {
  id: string;
  slotCode: string;
  zoneId: string;
  zoneName: string;
  slotType: SlotType;
  features: string[];
  status: SlotStatus;
  currentSessionId?: string;
  /** Biển số xe hiện đang đỗ tại slot (chỉ có khi status === "occupied"). */
  currentPlate?: string;
  floor: number;
  notes?: string;
  accessPolicy: SlotAccessPolicy;
  quotaType?: "member" | "walk_in";
  aiPolygon?: [number, number][];
  updatedAt?: string;
};

export type SlotMapEntry = {
  zoneId: string;
  zoneName: string;
  slots: ParkingSlot[];
};

// --- Subscription ---
export type SubscriptionPlan = {
  id: string;
  name: string;
  description?: string;
  duration: "monthly" | "quarterly" | "yearly";
  durationDays: number;
  price: number;
  isActive: boolean;
  // -1 = không giới hạn (mặc định), >=0 = giới hạn tối đa
  maxVehicles: number;
};

export type SubscriptionVehicle = {
  id: string;
  plate: string;
  ownerName?: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  engineNo?: string | null;
  chassisNo?: string | null;
  year?: number | null;
  status?: string | null;
  rejectionReason?: string | null;
  imageUrl?: string | null;
};

export type Subscription = {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  /**
   * Xe chính mà gói này đang gắn vào (1 gói = 1 xe).
   * Mỗi user có thể có nhiều gói, mỗi gói có 1 xe riêng.
   */
  primaryVehicleId?: string | null;
  primaryVehicle?: SubscriptionVehicle | null;
  /**
   * Mã thành viên per-sub (mỗi xe có 1 mã riêng → quét QR ở cổng).
   */
  memberCode?: string | null;
  startDate: string;
  endDate: string;
  status: "pending_payment" | "active" | "expired" | "cancelled";
  autoRenew: boolean;
  transactionId?: string;
  renewalCount: number;
  createdAt: string;
  // Chỉ trả về cho admin: thông tin khách hàng sở hữu gói.
  user?: SubscriptionCustomerInfo | null;
};

export type SubscriptionCustomerInfo = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  avatarUrl: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  company: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  createdAt: string;
};

// --- Device Maintenance ---
export type DeviceMaintenanceLog = {
  id: string;
  deviceId: string;
  deviceName: string;
  type: "scheduled" | "repair" | "inspection" | "replacement";
  description: string;
  performedBy?: string;
  performedAt: string;
  cost: number;
  notes?: string;
  status: "planned" | "in_progress" | "completed";
  createdAt: string;
};

// --- Analytics ---
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
  plate?: string;
  sessionCount: number;
  totalSpent: number;
};

export type PeakHourPoint = {
  dayOfWeek: number;
  hour: number;
  count: number;
};

export type CapacityConfig = {
  id: string;
  key: string;
  globalCapacity: number;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CapacityZoneSummary = {
  id: string;
  name: string;
  capacity: number;
  walkInQuota: number;
  subscriberQuota: number;
  isActive: boolean;
};

export type CapacityChangeLog = {
  id: string;
  entityType: "global" | "zone";
  zoneId?: string | null;
  zoneName?: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changedBy?: {
    id: string | null;
    name: string | null;
    email: string | null;
  } | null;
  changedAt: string;
  reason?: string | null;
};

export type ZoneUsage = {
  zoneId: string;
  zoneName: string;
  capacity: number;
  walkInQuota: number;
  subscriberQuota: number;
  occupied: number;
  walkInOccupied: number;
  subscriberOccupied: number;
  walkInOver: boolean;
  subscriberOver: boolean;
};

export type CapacityUsage = {
  global: {
    capacity: number;
    occupied: number;
    walkInOccupied: number;
    subscriberOccupied: number;
    over: boolean;
  };
  perZone: ZoneUsage[];
};

export type SlotStatusBadge = "empty" | "occupied" | "reserved" | "maintenance";

export type ZoneSlotItem = {
  id: string;
  slotCode: string;
  floor: number;
  slotType: string;
  status: SlotStatusBadge;
  currentSessionId: string | null;
  currentPlate: string | null;
  isSubscriber: boolean;
  features: string[];
  notes: string | null;
};

export type ZoneFloorSummary = {
  floor: number;
  total: number;
  empty: number;
  occupied: number;
  reserved: number;
  maintenance: number;
};

export type ZoneSlotsResponse = {
  zone: {
    id: string;
    name: string;
    capacity: number;
    walkInQuota: number;
    subscriberQuota: number;
  };
  summary: {
    total: number;
    empty: number;
    occupied: number;
    reserved: number;
    maintenance: number;
    walkInOccupied: number;
    subscriberOccupied: number;
    walkInOver: boolean;
    subscriberOver: boolean;
  };
  floors: ZoneFloorSummary[];
  slots: ZoneSlotItem[];
};

// ─── Staff Application (đăng ký làm nhân viên) ────────────────────
export type StaffApplicationStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type StaffApplicationHistoryAction =
  | "DRAFT_CREATED"
  | "SUBMITTED"
  | "EDITED"
  | "REJECTED"
  | "RESUBMITTED"
  | "APPROVED"
  | "CANCELLED"
  | "MIGRATED";

export type StaffApplicationHistory = {
  id: string;
  applicationId: string;
  userId: string;
  action: StaffApplicationHistoryAction;
  oldStatus?: StaffApplicationStatus | null;
  newStatus: StaffApplicationStatus;
  performedBy?: string | null;
  performedRole?: "customer" | "admin" | "staff" | null;
  note?: string | null;
  changedFields: string[];
  before: Partial<StaffApplication>;
  after: Partial<StaffApplication>;
  sequence: number;
  createdAt: string;
};

export type StaffApplicationShift =
  | "morning"
  | "afternoon"
  | "night"
  | "flexible";

export type StaffApplication = {
  id: string;
  userId: string;
  phone: string;
  idCardNumber: string;
  address: string;
  experience?: string | null;
  reason: string;
  preferredShift: StaffApplicationShift;
  status: StaffApplicationStatus;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  submittedAt?: string | null;
  resubmittedAt?: string | null;
  resubmitCount?: number;
  createdAt: string;
  updatedAt?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type StaffApplicationListResponse = {
  applications: StaffApplication[];
  total: number;
  page: number;
  limit: number;
};

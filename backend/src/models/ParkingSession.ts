import mongoose, { Model, Schema } from "mongoose";
import { requireResponsibleStaffAt } from "../services/shiftResponsibility.service.js";

export type DailyRateType = "day" | "night";
export type CustomerType = "member" | "guest";
export type QuotaType = "member" | "walk_in";
export type DailyBreakdown = {
  dayIndex: number;
  date: string;
  rateType: DailyRateType;
  fee: number;
  checkOutHour: number;
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
  dailyBreakdown: DailyBreakdown[];
  subscriptionDiscount?: number;
  subscriptionWarn?: string;
};

export type ParkingSessionDocument = {
  _id: mongoose.Types.ObjectId;
  plate: string;
  ownerName: string;
  vehicleType: "Ô tô";
  checkInAt: Date;
  checkOutAt?: Date;
  expectedCheckOutAt?: Date;
  slot: string;
  slotId?: mongoose.Types.ObjectId;
  // Chốt ngay lúc check-in, không thay đổi khi checkout.
  customerType: CustomerType;
  quotaType: QuotaType;
  zone?: string;
  floor?: number;
  slotType?: string;
  status: "Đang gửi" | "Đã hoàn thành" | "Đã hủy";
  paymentStatus: "unpaid" | "partial_paid" | "fully_paid";
  paymentMethod?: string;
  fee: number;
  paidAmount: number;
  discountAmount: number;
  discountReason?: string;
  feeBreakdown?: FeeBreakdown;
  ownerUserId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  entryImageUrl?: string;
  exitImageUrl?: string;
  exitState?:
    | "waiting_rfid"
    | "rfid_verified"
    | "payment_pending"
    | "gate_authorizing"
    | "gate_opened";
  exitDetectedAt?: Date;
  exitRfidUid?: string;
  expectedExitRfidUid?: string;
  exitRfidVerifiedAt?: Date;
  rfidCardId?: string;
  entryRfidUid?: string;
  // UID tra cứu từ hồ sơ Member khi đầu đọc không thể xác minh thẻ lúc vào.
  entryExpectedRfidUid?: string;
  rfidAssignedAt?: Date;
  rfidReturnedAt?: Date;
  rfidGate?: "entry" | "exit";
  entryDetectedPlate?: string;
  exitDetectedPlate?: string;
  entryConfidence?: number;
  exitConfidence?: number;
  entryImageHash?: string;
  exitImageHash?: string;
  aiRawText?: string;
  vehicleMatchScore?: number;
  matchStatus?: "Chưa checkout" | "Khớp" | "Không khớp";
  verificationStatus?: "Không cần" | "Chờ duyệt" | "Đã duyệt" | "Từ chối";
  manualPlate?: string;
  verificationNote?: string;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  entrySource?: "camera" | "manual";
  exitSource?: "camera" | "manual";
  entryPhotoStatus?: "photo_captured" | "camera_unavailable";
  exitPhotoStatus?: "photo_captured" | "camera_unavailable";
  manualEntryReason?: string;
  manualExitReason?: string;
  visualConfirmed?: boolean;
  visualConfirmedBy?: mongoose.Types.ObjectId;
  visualConfirmedAt?: Date;
  entryRfidUnverified?: boolean;
  exitRfidManualVerified?: boolean;
  cashNote?: string;
  collectedBy?: mongoose.Types.ObjectId;
  exceptionType?: string;
  exceptionEvidence?: Record<string, unknown>;
  transactionId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  checkInStaff?: mongoose.Types.ObjectId;
  checkOutStaff?: mongoose.Types.ObjectId;
  entryGate?: string;
  exitGate?: string;
  ownerEmail?: string;
  prepaidCheckoutAt?: Date;
  lastReminderAt?: Date;
  lastPrepaidReminderAt?: Date;
  isOverstayed: boolean;
  overdueMinutes: number;
  cancellationReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

const parkingSessionSchema = new Schema<ParkingSessionDocument>(
  {
    plate: { type: String, required: true, trim: true, uppercase: true },
    ownerName: { type: String, required: true, trim: true },
    vehicleType: { type: String, enum: ["Ô tô"], required: true },
    checkInAt: { type: Date, default: Date.now },
    checkOutAt: { type: Date },
    expectedCheckOutAt: { type: Date },
    slot: { type: String, required: true },
    slotId: { type: Schema.Types.ObjectId, ref: "ParkingSlot" },
    customerType: { type: String, enum: ["member", "guest"], default: "guest", required: true, index: true },
    quotaType: { type: String, enum: ["member", "walk_in"], default: "walk_in", required: true, index: true },
    zone: { type: String },
    floor: { type: Number },
    slotType: { type: String },
    status: {
      type: String,
      enum: ["Đang gửi", "Đã hoàn thành", "Đã hủy"],
      default: "Đang gửi",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial_paid", "fully_paid"],
      default: "unpaid",
      index: true,
    },
    paymentMethod: { type: String, trim: true },
    fee: { type: Number, required: true, default: 0, min: 0 },
    paidAmount: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, required: true, default: 0, min: 0 },
    discountReason: { type: String },
    feeBreakdown: {
      totalMinutes: { type: Number },
      freeMinutes: { type: Number },
      billableMinutes: { type: Number },
      billableHours: { type: Number },
      hourlyRate: { type: Number },
      parkingFee: { type: Number },
      overdueFine: { type: Number },
      totalFee: { type: Number },
      dailyBreakdown: [
        {
          dayIndex: { type: Number },
          date: { type: String },
          rateType: { type: String, enum: ["day", "night"] },
          fee: { type: Number },
          checkOutHour: { type: Number },
        },
      ],
      subscriptionDiscount: { type: Number },
      subscriptionWarn: { type: String },
    },
    entryImageUrl: { type: String },
    exitImageUrl: { type: String },
    exitState: {
      type: String,
      enum: [
        "waiting_rfid",
        "rfid_verified",
        "payment_pending",
        "gate_authorizing",
        "gate_opened",
      ],
      index: true,
    },
    exitDetectedAt: { type: Date },
    exitRfidUid: { type: String },
    expectedExitRfidUid: { type: String, trim: true, uppercase: true },
    exitRfidVerifiedAt: { type: Date },
    rfidCardId: { type: String, index: true },
    entryRfidUid: { type: String, trim: true, uppercase: true, index: true },
    entryExpectedRfidUid: { type: String, trim: true, uppercase: true, index: true },
    rfidAssignedAt: { type: Date },
    rfidReturnedAt: { type: Date },
    rfidGate: { type: String, enum: ["entry", "exit"] },
    entryDetectedPlate: { type: String },
    exitDetectedPlate: { type: String },
    entryConfidence: { type: Number },
    exitConfidence: { type: Number },
    entryImageHash: { type: String },
    exitImageHash: { type: String },
    aiRawText: { type: String },
    vehicleMatchScore: { type: Number },
    matchStatus: {
      type: String,
      enum: ["Chưa checkout", "Khớp", "Không khớp"],
      default: "Chưa checkout",
    },
    verificationStatus: {
      type: String,
      enum: ["Không cần", "Chờ duyệt", "Đã duyệt", "Từ chối"],
      default: "Không cần",
      index: true,
    },
    manualPlate: { type: String, trim: true, uppercase: true },
    verificationNote: { type: String },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    entrySource: { type: String, enum: ["camera", "manual"], index: true },
    exitSource: { type: String, enum: ["camera", "manual"], index: true },
    entryPhotoStatus: { type: String, enum: ["photo_captured", "camera_unavailable"] },
    exitPhotoStatus: { type: String, enum: ["photo_captured", "camera_unavailable"] },
    manualEntryReason: { type: String, trim: true },
    manualExitReason: { type: String, trim: true },
    visualConfirmed: { type: Boolean, default: false },
    visualConfirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    visualConfirmedAt: { type: Date },
    entryRfidUnverified: { type: Boolean, default: false },
    exitRfidManualVerified: { type: Boolean, default: false },
    cashNote: { type: String, trim: true },
    collectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    exceptionType: { type: String, trim: true, index: true },
    exceptionEvidence: { type: Schema.Types.Mixed },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    checkInStaff: { type: Schema.Types.ObjectId, ref: "User" },
    checkOutStaff: { type: Schema.Types.ObjectId, ref: "User" },
    entryGate: { type: String },
    exitGate: { type: String },
    ownerEmail: { type: String, trim: true, lowercase: true },
    prepaidCheckoutAt: { type: Date },
    lastReminderAt: { type: Date },
    lastPrepaidReminderAt: { type: Date },
    isOverstayed: { type: Boolean, required: true, default: false },
    overdueMinutes: { type: Number, required: true, default: 0 },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    cancellationReason: { type: String },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

parkingSessionSchema.pre("validate", async function () {
  if (this.isNew && !this.checkInStaff) {
    this.checkInStaff = await requireResponsibleStaffAt(this.checkInAt || new Date());
  }
});

parkingSessionSchema.index({ plate: 1, checkInAt: -1 });
parkingSessionSchema.index({ slotId: 1 });
parkingSessionSchema.index({ checkInAt: -1 });
parkingSessionSchema.index({ checkOutAt: 1 }, { sparse: true });

export const ParkingSession: Model<ParkingSessionDocument> =
  mongoose.models.ParkingSession ||
  mongoose.model<ParkingSessionDocument>(
    "ParkingSession",
    parkingSessionSchema,
  );

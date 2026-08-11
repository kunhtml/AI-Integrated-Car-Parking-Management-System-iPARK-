import mongoose, { Model, Schema } from "mongoose";

export type DailyRateType = "day" | "night";
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
  exitRfidVerifiedAt?: Date;
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
    exitRfidVerifiedAt: { type: Date },
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

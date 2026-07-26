import mongoose, { Model, Schema } from "mongoose";
import type { FeeBreakdown } from "../services/pricing.service.js";

export type ParkingSessionDocument = {
  _id: mongoose.Types.ObjectId;
  plate: string;
  ownerName: string;
  vehicleType: "Ô tô";
  rfidUid?: string;
  checkInAt: Date;
  checkOutAt?: Date;
  slot: string;
  status: "Đang gửi" | "Đã hoàn thành";
  paymentStatus: "unpaid" | "pending" | "paid" | "partial_paid" | "fully_paid";
  paymentMethod?: "cash" | "payos" | "vietqr" | "wallet" | "subscription";
  fee: number;
  paidAmount?: number;
  isMember: boolean;
  subscriptionId?: mongoose.Types.ObjectId;
  memberCode?: string;
  subscriptionPlanName?: string;
  paymentLookupCode?: string;
  qrCode?: string;
  qrExpiry?: Date;
  barrierTriggered?: boolean;
  barrierTriggeredAt?: Date;
  barrierAction?: "open_entry" | "open_exit";
  feeBreakdown?: FeeBreakdown;
  ownerUserId?: mongoose.Types.ObjectId;
  entryImageUrl?: string;
  exitImageUrl?: string;
  entryDetectedPlate?: string;
  exitDetectedPlate?: string;
  entryConfidence?: number;
  exitConfidence?: number;
  aiRawText?: string;
  entryImageHash?: string;
  exitImageHash?: string;
  vehicleMatchScore?: number;
  matchStatus?: "Chưa checkout" | "Khớp" | "Không khớp";
  verificationStatus?: "Không cần" | "Chờ duyệt" | "Đã duyệt" | "Từ chối";
  manualPlate?: string;
  verificationNote?: string;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  transactionId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const parkingSessionSchema = new Schema<ParkingSessionDocument>(
  {
    plate: { type: String, required: true, trim: true, uppercase: true, index: true },
    ownerName: { type: String, required: true, trim: true },
    vehicleType: { type: String, enum: ["Ô tô"], required: true },
    rfidUid: { type: String, trim: true, uppercase: true, index: true },
    checkInAt: { type: Date, default: Date.now },
    checkOutAt: { type: Date },
    slot: { type: String, required: true },
    status: { type: String, enum: ["Đang gửi", "Đã hoàn thành"], default: "Đang gửi" },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "partial_paid", "fully_paid"],
      default: "unpaid",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "payos", "vietqr", "wallet", "subscription"],
    },
    fee: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    isMember: { type: Boolean, default: false, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", index: true },
    memberCode: { type: String, trim: true },
    subscriptionPlanName: { type: String, trim: true },
    paymentLookupCode: { type: String, trim: true, uppercase: true, index: true },
    qrCode: { type: String },
    qrExpiry: { type: Date },
    barrierTriggered: { type: Boolean, default: false },
    barrierTriggeredAt: { type: Date },
    barrierAction: { type: String, enum: ["open_entry", "open_exit"] },
    feeBreakdown: {
      totalMinutes: { type: Number },
      freeMinutes: { type: Number },
      billableMinutes: { type: Number },
      billableHours: { type: Number },
      hourlyRate: { type: Number },
      parkingFee: { type: Number },
      overdueFine: { type: Number },
      totalFee: { type: Number },
    },
    entryImageUrl: { type: String },
    exitImageUrl: { type: String },
    entryDetectedPlate: { type: String },
    exitDetectedPlate: { type: String },
    entryConfidence: { type: Number },
    exitConfidence: { type: Number },
    aiRawText: { type: String },
    entryImageHash: { type: String },
    exitImageHash: { type: String },
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
  },
  { timestamps: true },
);

export const ParkingSession: Model<ParkingSessionDocument> =
  mongoose.models.ParkingSession ||
  mongoose.model<ParkingSessionDocument>("ParkingSession", parkingSessionSchema);

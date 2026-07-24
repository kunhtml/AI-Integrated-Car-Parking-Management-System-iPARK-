import mongoose, { Model, Schema } from "mongoose";
import type { FeeBreakdown } from "../services/pricing.service.js";

export type ParkingSessionDocument = {
  _id: mongoose.Types.ObjectId;
  plate: string;
  ownerName: string;
  vehicleType: "Ô tô";
  checkInAt: Date;
  checkOutAt?: Date;
  slot: string;
  status: "Đang gửi" | "Đã hoàn thành" | "Đã hủy";
  paymentStatus: "unpaid" | "pending" | "paid";
  fee: number;
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
  priorityType?: "member" | "walkin";
  slotId?: mongoose.Types.ObjectId;
  expectedCheckOutAt?: Date;
  prepaidCheckoutAt?: Date;
  ownerEmail?: string;
  paidAmount?: number;
  paymentMethod?: "payos" | "wallet" | "cash";
  entryGate?: string;
  rfidCardId?: string;
  rfidAssignedAt?: Date;
  rfidReturnedAt?: Date;
  rfidGate?: "entry" | "exit";
  cancelReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const parkingSessionSchema = new Schema<ParkingSessionDocument>(
  {
    plate: { type: String, required: true, trim: true, uppercase: true },
    ownerName: { type: String, required: true, trim: true },
    vehicleType: { type: String, enum: ["Ô tô"], default: "Ô tô", required: true },
    checkInAt: { type: Date, default: Date.now },
    checkOutAt: { type: Date },
    slot: { type: String, required: true },
    status: { type: String, enum: ["Đang gửi", "Đã hoàn thành", "Đã hủy"], default: "Đang gửi" },
    paymentStatus: { type: String, enum: ["unpaid", "pending", "paid"], default: "unpaid" },
    fee: { type: Number, default: 0 },
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
    matchStatus: { type: String, enum: ["Chưa checkout", "Khớp", "Không khớp"], default: "Chưa checkout" },
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
    priorityType: { type: String, enum: ["member", "walkin"], default: "walkin" },
    slotId: { type: Schema.Types.ObjectId, ref: "ParkingSlot" },
    expectedCheckOutAt: { type: Date },
    prepaidCheckoutAt: { type: Date },
    ownerEmail: { type: String },
    paidAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ["payos", "wallet", "cash"] },
    entryGate: { type: String },
    rfidCardId: { type: String, trim: true, uppercase: true, index: true },
    rfidAssignedAt: { type: Date },
    rfidReturnedAt: { type: Date },
    rfidGate: { type: String, enum: ["entry", "exit"] },
    cancelReason: { type: String, trim: true },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

export const ParkingSession: Model<ParkingSessionDocument> =
  mongoose.models.ParkingSession ||
  mongoose.model<ParkingSessionDocument>("ParkingSession", parkingSessionSchema);

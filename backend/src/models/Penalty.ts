import mongoose, { Model, Schema } from "mongoose";
import { PenaltyViolationType } from "./PenaltyConfig.js";

// Vé phạt cho một xe vi phạm tại một ô đỗ cụ thể.
export type PenaltyDocument = {
  _id: mongoose.Types.ObjectId;
  plate: string; // biển số xe bị phạt
  violationType: PenaltyViolationType;
  amount: number; // tiền phạt áp dụng (VND), chốt tại thời điểm lập vé
  // Ô đỗ liên quan
  slotId?: mongoose.Types.ObjectId;
  slotCode: string;
  zoneId?: mongoose.Types.ObjectId;
  zoneName?: string;
  // Liên kết phiên gửi (nếu xe có phiên)
  sessionId?: mongoose.Types.ObjectId;
  // Bằng chứng
  evidenceImageUrl?: string;
  aiConfidence?: number;
  note?: string;
  status: "pending" | "paid" | "waived" | "disputed";
  issuedBy?: mongoose.Types.ObjectId;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const penaltySchema = new Schema<PenaltyDocument>(
  {
    plate: { type: String, required: true, trim: true, uppercase: true, index: true },
    violationType: {
      type: String,
      enum: ["over_line"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0, default: 0 },
    slotId: { type: Schema.Types.ObjectId, ref: "ParkingSlot", index: true },
    slotCode: { type: String, required: true, trim: true, uppercase: true },
    zoneId: { type: Schema.Types.ObjectId, ref: "Zone", index: true },
    zoneName: { type: String, trim: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession" },
    evidenceImageUrl: { type: String },
    aiConfidence: { type: Number },
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "paid", "waived", "disputed"],
      default: "pending",
      index: true,
    },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

penaltySchema.index({ status: 1, createdAt: -1 });

export const Penalty: Model<PenaltyDocument> =
  mongoose.models.Penalty || mongoose.model<PenaltyDocument>("Penalty", penaltySchema);

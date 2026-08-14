import mongoose, { Model, Schema } from "mongoose";

export type RfidPurchaseStatus = "pending_payment" | "waiting_issuance" | "approved_waiting_assignment" | "completed" | "rejected";
export type RfidPurchaseRequestDocument = {
  _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; vehicleId: mongoose.Types.ObjectId;
  status: RfidPurchaseStatus; salePrice: number; rfidCardId?: mongoose.Types.ObjectId; transactionId?: mongoose.Types.ObjectId;
  reviewedBy?: mongoose.Types.ObjectId; reviewedAt?: Date; issuedBy?: mongoose.Types.ObjectId; issuedAt?: Date;
  rejectionReason?: string; note?: string; createdAt: Date; updatedAt: Date;
};
const schema = new Schema<RfidPurchaseRequestDocument>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
  status: { type: String, enum: ["pending_payment", "waiting_issuance", "approved_waiting_assignment", "completed", "rejected"], default: "pending_payment", index: true },
  salePrice: { type: Number, required: true, min: 0 }, rfidCardId: { type: Schema.Types.ObjectId, ref: "RfidCard" }, transactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" }, reviewedAt: Date, issuedBy: { type: Schema.Types.ObjectId, ref: "User" }, issuedAt: Date,
  rejectionReason: { type: String, trim: true }, note: { type: String, trim: true },
}, { timestamps: true });
schema.index({ vehicleId: 1, status: 1 });
export const RfidPurchaseRequest: Model<RfidPurchaseRequestDocument> = mongoose.models.RfidPurchaseRequest || mongoose.model<RfidPurchaseRequestDocument>("RfidPurchaseRequest", schema);

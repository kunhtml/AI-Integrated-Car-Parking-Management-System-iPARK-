import mongoose, { Model, Schema } from "mongoose";

export type TransactionStatus = "pending" | "paid" | "failed" | "cancelled";

export type TransactionDocument = {
  _id: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  method: "vietqr" | "wallet" | "cash";
  amount: number;
  status: TransactionStatus;
  content: string;
  qrUrl?: string;
  paidAt?: Date;
  confirmedBy?: mongoose.Types.ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
};

const transactionSchema = new Schema<TransactionDocument>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    method: { type: String, enum: ["vietqr", "wallet", "cash"], default: "vietqr" },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "paid", "failed", "cancelled"], default: "pending" },
    content: { type: String, required: true },
    qrUrl: { type: String },
    paidAt: { type: Date },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    note: { type: String },
  },
  { timestamps: true },
);

export const Transaction: Model<TransactionDocument> =
  mongoose.models.Transaction ||
  mongoose.model<TransactionDocument>("Transaction", transactionSchema);

import mongoose, { Model, Schema } from "mongoose";

export type TransactionStatus = "pending" | "paid" | "failed" | "cancelled";

export type TransactionDocument = {
  _id: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  penaltyId?: mongoose.Types.ObjectId;
  method: "payos" | "cash";
  amount: number;
  status: TransactionStatus;
  paidAt?: Date;
  note?: string;
  discount?: number;
  payosOrderCode?: string;
  payosPaymentLinkId?: string;
  payosCheckoutUrl?: string;
  payosQrCode?: string;
  payosAccountNumber?: string;
  payosAccountName?: string;
  payosBin?: string;
  createdAt: Date;
  updatedAt: Date;
};

const transactionSchema = new Schema<TransactionDocument>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", index: true },
    penaltyId: { type: Schema.Types.ObjectId, ref: "Penalty", index: true },
    method: { type: String, enum: ["payos", "cash"], default: "payos" },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
    },
    paidAt: { type: Date },
    note: { type: String },
    discount: { type: Number, default: 0 },
    payosOrderCode: { type: String, trim: true, index: { unique: true, sparse: true } },
    payosPaymentLinkId: { type: String, trim: true },
    payosCheckoutUrl: { type: String },
    payosQrCode: { type: String },
    payosAccountNumber: { type: String, trim: true },
    payosAccountName: { type: String, trim: true },
    payosBin: { type: String, trim: true },
  },
  { timestamps: true },
);

transactionSchema.index({ status: 1, createdAt: -1 });

export const Transaction: Model<TransactionDocument> =
  mongoose.models.Transaction ||
  mongoose.model<TransactionDocument>("Transaction", transactionSchema);

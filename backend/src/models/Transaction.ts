import mongoose, { Model, Schema } from "mongoose";

export type TransactionStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";
export type TransactionType =
  | "parking"
  | "subscription"
  | "penalty"
  | "rfid_sale"
  | "rfid_deposit"
  | "rfid_replacement"
  | "rfid_refund";

export type TransactionDocument = {
  _id: mongoose.Types.ObjectId;
  transactionType?: TransactionType;
  sessionId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  penaltyId?: mongoose.Types.ObjectId;
  rfidCardId?: mongoose.Types.ObjectId;
  replacementOf?: mongoose.Types.ObjectId;
  rfidCardType?: "guest" | "member";
  uid?: string;
  plate?: string;
  createdBy?: mongoose.Types.ObjectId;
  method: "payos" | "cash" | "wallet";
  amount: number;
  salePrice?: number;
  depositAmount?: number;
  status: TransactionStatus;
  paidAt?: Date;
  note?: string;
  refundReason?: string;
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
    transactionType: { type: String, enum: ["parking", "subscription", "penalty", "rfid_sale", "rfid_deposit", "rfid_replacement", "rfid_refund"], index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", index: true },
    penaltyId: { type: Schema.Types.ObjectId, ref: "Penalty", index: true },
    rfidCardId: { type: Schema.Types.ObjectId, ref: "RfidCard", index: true },
    replacementOf: { type: Schema.Types.ObjectId, ref: "RfidCard" },
    rfidCardType: { type: String, enum: ["guest", "member"], index: true },
    uid: { type: String, trim: true, index: true },
    plate: { type: String, trim: true, uppercase: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    method: { type: String, enum: ["payos", "cash", "wallet"], default: "payos" },
    amount: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, min: 0, default: 0 },
    depositAmount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["pending", "paid", "failed", "cancelled", "refunded"], default: "pending" },
    paidAt: { type: Date },
    note: { type: String },
    refundReason: { type: String },
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
transactionSchema.index({ transactionType: 1, createdAt: -1 });

export const Transaction: Model<TransactionDocument> =
  mongoose.models.Transaction || mongoose.model<TransactionDocument>("Transaction", transactionSchema);

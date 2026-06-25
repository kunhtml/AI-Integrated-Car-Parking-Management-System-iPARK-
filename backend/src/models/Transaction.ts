import mongoose, { Model, Schema } from "mongoose";

export type TransactionStatus = "pending" | "paid" | "failed" | "cancelled";

export type TransactionDocument = {
  _id: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  method: "payos" | "wallet" | "cash";
  amount: number;
  status: TransactionStatus;
  content?: string;
  qrUrl?: string;
  paidAt?: Date;
  confirmedBy?: mongoose.Types.ObjectId;
  note?: string;
  // Extension tracking
  extensionId?: mongoose.Types.ObjectId;
  extensionType?: "initial" | "extend" | "overtime" | "adjustment";
  previousFee?: number;
  newFee?: number;
  // Subscription tracking
  subscriptionId?: mongoose.Types.ObjectId;
  // Extended
  transactionCode?: string;
  bankTransactionId?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  gateway?: string;
  discount?: number;
  couponCode?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  refundedBy?: mongoose.Types.ObjectId;
  receiptUrl?: string;
  invoiceNumber?: string;
  currency?: string;
  exchangeRate?: number;
  fee?: number;
  tax?: number;
  paymentGatewayResponse?: string;
  // PayOS specific fields
  payosOrderCode?: string;
  payosPaymentLinkId?: string;
  payosCheckoutUrl?: string;
  payosQrCode?: string;
  createdAt: Date;
  updatedAt: Date;
};

const transactionSchema = new Schema<TransactionDocument>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    method: { type: String, enum: ["payos", "wallet", "cash"], default: "payos" },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "paid", "failed", "cancelled"], default: "pending" },
    content: { type: String },
    qrUrl: { type: String },
    paidAt: { type: Date },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    note: { type: String },
    // Extension tracking
    extensionId: { type: Schema.Types.ObjectId, ref: "ParkingExtension" },
    extensionType: { type: String, enum: ["initial", "extend", "overtime", "adjustment"] },
    previousFee: { type: Number },
    newFee: { type: Number },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", index: true },
    // Extended
    transactionCode: { type: String, trim: true },
    bankTransactionId: { type: String, trim: true },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    accountName: { type: String, trim: true },
    gateway: { type: String, trim: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String, trim: true },
    refundAmount: { type: Number },
    refundReason: { type: String },
    refundedAt: { type: Date },
    refundedBy: { type: Schema.Types.ObjectId, ref: "User" },
    receiptUrl: { type: String },
    invoiceNumber: { type: String, trim: true },
    currency: { type: String, default: "VND", trim: true },
    exchangeRate: { type: Number },
    fee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    paymentGatewayResponse: { type: String },
    // PayOS specific fields
    payosOrderCode: { type: String, trim: true, index: { unique: true, sparse: true } },
    payosPaymentLinkId: { type: String, trim: true },
    payosCheckoutUrl: { type: String },
    payosQrCode: { type: String },
  },
  { timestamps: true },
);

export const Transaction: Model<TransactionDocument> =
  mongoose.models.Transaction ||
  mongoose.model<TransactionDocument>("Transaction", transactionSchema);

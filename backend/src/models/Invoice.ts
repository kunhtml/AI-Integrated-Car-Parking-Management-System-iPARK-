import mongoose, { Model, Schema } from "mongoose";

export type InvoiceStatus = "Draft" | "Issued" | "Paid" | "Cancelled";

export type InvoiceDocument = {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  sessionId?: mongoose.Types.ObjectId;
  transactionId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  taxId?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  issuedAt?: Date;
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

const invoiceItemSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const invoiceSchema = new Schema<InvoiceDocument>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession" },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    customerAddress: { type: String, trim: true },
    taxId: { type: String, trim: true },
    items: [invoiceItemSchema],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Draft", "Issued", "Paid", "Cancelled"],
      default: "Draft",
      index: true,
    },
    issuedAt: { type: Date },
    paidAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ userId: 1, createdAt: -1 });

export const Invoice: Model<InvoiceDocument> =
  mongoose.models.Invoice ||
  mongoose.model<InvoiceDocument>("Invoice", invoiceSchema);

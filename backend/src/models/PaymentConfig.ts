import mongoose, { Model, Schema } from "mongoose";

export type PaymentConfigDocument = {
  _id: mongoose.Types.ObjectId;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  transferPrefix: string;
  isActive: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  payosClientId?: string;
  payosApiKey?: string;
  payosEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const paymentConfigSchema = new Schema<PaymentConfigDocument>(
  {
    bankName: { type: String, default: "Ngân hàng test" },
    bankBin: { type: String, default: "970436" },
    accountNumber: { type: String, default: "0000000000" },
    accountName: { type: String, default: "IPARK" },
    transferPrefix: { type: String, default: "IPARK" },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    payosClientId: { type: String },
    payosApiKey: { type: String },
    payosEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const PaymentConfig: Model<PaymentConfigDocument> =
  mongoose.models.PaymentConfig ||
  mongoose.model<PaymentConfigDocument>("PaymentConfig", paymentConfigSchema);

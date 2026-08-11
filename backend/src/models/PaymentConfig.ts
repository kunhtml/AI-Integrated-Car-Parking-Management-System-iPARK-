import mongoose, { Model, Schema } from "mongoose";

export type PaymentConfigDocument = {
  _id: mongoose.Types.ObjectId;
  isActive: boolean;
  payosEnabled?: boolean;
  payosClientId?: string;
  payosApiKey?: string;
  payosWebhookUrl?: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const paymentConfigSchema = new Schema<PaymentConfigDocument>(
  {
    isActive: { type: Boolean, required: true, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    payosEnabled: { type: Boolean, default: false },
    payosClientId: { type: String },
    payosApiKey: { type: String },
    payosWebhookUrl: { type: String },
  },
  { timestamps: true },
);

export const PaymentConfig: Model<PaymentConfigDocument> =
  mongoose.models.PaymentConfig ||
  mongoose.model<PaymentConfigDocument>("PaymentConfig", paymentConfigSchema);

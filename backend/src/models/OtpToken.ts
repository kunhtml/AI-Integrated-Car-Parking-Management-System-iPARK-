import mongoose, { Model, Schema } from "mongoose";

export type OtpTokenDocument = {
  _id: mongoose.Types.ObjectId;
  email: string;
  otpHash: string;
  purpose: "reset-password";
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const otpTokenSchema = new Schema<OtpTokenDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    purpose: { type: String, enum: ["reset-password"], default: "reset-password" },
    expiresAt: { type: Date, required: true, expires: 0 },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

export const OtpToken: Model<OtpTokenDocument> =
  mongoose.models.OtpToken || mongoose.model<OtpTokenDocument>("OtpToken", otpTokenSchema);

import mongoose, { Schema } from "mongoose";

const otpSchema = new Schema({
  email: String,
  otpHash: String,
  purpose: String,
  usedAt: Date,
  expiresAt: Date,
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

export const OtpToken = mongoose.models.OtpToken || mongoose.model("OtpToken", otpSchema);

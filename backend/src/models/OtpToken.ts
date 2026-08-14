import mongoose, { Model, Schema } from "mongoose";

export type OtpTokenDocument = {
  _id: mongoose.Types.ObjectId;
  email: string;
  otpHash: string;
  purpose: "reset-password" | "verify-email" | "two-factor" | "change-email";
  /** Email mới (chỉ dùng cho purpose=change-email) */
  newEmail?: string;
  // Luu payload dang ky tam thoi (chi dung cho verify-email truoc khi user duoc tao)
  pendingUser?: {
    name: string;
    passwordHash: string;
    phone?: string;
    gender?: string;
    birthDate?: string;
    address?: string;
    city?: string;
    district?: string;
    company?: string;
    taxCode?: string;
    acceptTerms: boolean;
  };
  expiresAt: Date;
  usedAt?: Date;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
};

const otpTokenSchema = new Schema<OtpTokenDocument>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: { type: String, required: true },
    purpose: {
      type: String,
      enum: ["reset-password", "verify-email", "two-factor", "change-email"],
      default: "reset-password",
    },
    pendingUser: { type: Schema.Types.Mixed },
    newEmail: { type: String, lowercase: true, trim: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    usedAt: { type: Date },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const OtpToken: Model<OtpTokenDocument> =
  mongoose.models.OtpToken ||
  mongoose.model<OtpTokenDocument>("OtpToken", otpTokenSchema);


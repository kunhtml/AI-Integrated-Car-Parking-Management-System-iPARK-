import mongoose, { Schema, type InferSchemaType } from "mongoose";

const otpSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    purpose: {
      type: String,
      enum: ["forgot_password", "verify_email"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    used: {
      type: Boolean,
      default: false,
      index: true,
    },
    verifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, purpose: 1, used: 1, createdAt: -1 });

export type Otp = InferSchemaType<typeof otpSchema>;
export const OtpModel = mongoose.model("Otp", otpSchema);

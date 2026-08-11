import mongoose, { Model, Schema } from "mongoose";

export type UserRole = "admin" | "staff" | "customer";

export type UserDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: "Đang hoạt động" | "Đã khóa";
  phone?: string;
  avatarUrl?: string;
  provider: "credentials" | "google" | "mixed";
  googleId?: string;
  twoFactorEnabled: boolean;
  lastLoginAt?: Date;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: /^\S+@\S+\.\S+$/,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "staff", "customer"],
      default: "customer",
    },
    status: {
      type: String,
      enum: ["Đang hoạt động", "Đã khóa"],
      default: "Đang hoạt động",
    },
    phone: { type: String },
    avatarUrl: { type: String },
    provider: {
      type: String,
      enum: ["credentials", "google", "mixed"],
      default: "credentials",
    },
    googleId: { type: String, index: true },
    twoFactorEnabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, status: 1 });

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", userSchema);

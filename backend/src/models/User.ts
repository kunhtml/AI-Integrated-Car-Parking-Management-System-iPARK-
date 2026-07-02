import mongoose, { Model, Schema } from "mongoose";

export type UserRole = "admin" | "staff" | "customer";

export type UserDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: "Đang hoạt động" | "Đã khóa";
  wallet: number;
  phone?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dob?: string;
  idCardNumber?: string;
  idCardIssueDate?: string;
  idCardExpiryDate?: string;
  address?: string;
  city?: string;
  district?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  company?: string;
  taxId?: string;
  avatarUrl?: string;
  provider: "credentials" | "google" | "mixed" | "local";
  googleId?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorPendingSecret?: string;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "staff", "customer"], default: "customer" },
    status: { type: String, enum: ["Đang hoạt động", "Đã khóa"], default: "Đang hoạt động" },
    wallet: { type: Number, default: 0 },
    phone: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    gender: { type: String },
    dob: { type: String },
    idCardNumber: { type: String },
    idCardIssueDate: { type: String },
    idCardExpiryDate: { type: String },
    address: { type: String },
    city: { type: String },
    district: { type: String },
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String },
    company: { type: String },
    taxId: { type: String },
    avatarUrl: { type: String },
    provider: {
      type: String,
      enum: ["credentials", "google", "mixed", "local"],
      default: "credentials",
    },
    googleId: { type: String, index: true },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    twoFactorPendingSecret: { type: String },
  },
  { timestamps: true },
);

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", userSchema);

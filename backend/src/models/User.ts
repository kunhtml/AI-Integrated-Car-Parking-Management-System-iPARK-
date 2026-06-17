import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String },
    provider: { type: String, default: "local" },
    role: { type: String, enum: ["admin", "staff", "customer"], default: "customer" },
    status: { type: String, enum: ["Đang hoạt động", "Đã khóa"], default: "Đang hoạt động" },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);

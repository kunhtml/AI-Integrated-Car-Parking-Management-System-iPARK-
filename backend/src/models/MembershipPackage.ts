import mongoose, { Model, Schema } from "mongoose";

export type MembershipPackageDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  billingCycle: "Daily" | "Monthly" | "Quarterly" | "Custom";
  price: number;
  durationDays: number;
  subscriberCount: number;
  renewalRate: number;
  status: "Active" | "Draft" | "Paused";
  features: string[];
  note?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const membershipPackageSchema = new Schema<MembershipPackageDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    billingCycle: { type: String, enum: ["Daily", "Monthly", "Quarterly", "Custom"], default: "Monthly" },
    price: { type: Number, default: 0, min: 0 },
    durationDays: { type: Number, default: 30, min: 1 },
    subscriberCount: { type: Number, default: 0, min: 0 },
    renewalRate: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: ["Active", "Draft", "Paused"], default: "Draft" },
    features: { type: [String], default: [] },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const MembershipPackage: Model<MembershipPackageDocument> =
  mongoose.models.MembershipPackage ||
  mongoose.model<MembershipPackageDocument>("MembershipPackage", membershipPackageSchema);

import mongoose, { Model, Schema } from "mongoose";

export type PricingConfigDocument = {
  _id: mongoose.Types.ObjectId;
  freeMinutes: number;
  hourlyRate: number;
  overnightRate: number;
  monthlyRate: number;
  overdueFineRate: number;
  dailyMaxRate: number;
  graceExitMinutes: number;
  effectiveFrom: Date;
  isActive: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const pricingConfigSchema = new Schema<PricingConfigDocument>(
  {
    freeMinutes: { type: Number, default: 20, min: 0 },
    hourlyRate: { type: Number, default: 0, min: 0 },
    overnightRate: { type: Number, default: 0, min: 0 },
    monthlyRate: { type: Number, default: 0, min: 0 },
    overdueFineRate: { type: Number, default: 0, min: 0 },
    dailyMaxRate: { type: Number, default: 0, min: 0 },
    graceExitMinutes: { type: Number, default: 10, min: 0 },
    effectiveFrom: { type: Date, default: () => new Date() },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const PricingConfig: Model<PricingConfigDocument> =
  mongoose.models.PricingConfig || mongoose.model<PricingConfigDocument>("PricingConfig", pricingConfigSchema);

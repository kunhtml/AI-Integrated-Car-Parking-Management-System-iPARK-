import mongoose, { Model, Schema } from "mongoose";

export type PricingConfigDocument = {
  _id: mongoose.Types.ObjectId;
  // Khách vãng lai: 2 khoảng giá theo giờ ra
  dayRate: number;
  nightRate: number;
  // 2 mốc giờ phân định ngày/đêm (giờ ra < nightStartHour và >= dayStartHour → day)
  dayStartHour: number;
  nightStartHour: number;
  gracePeriod: number;
  freeMinutes: number;
  hourlyRate: number;
  overnightRate: number;
  monthlyRate: number;
  overdueFineRate: number;
  dailyMaxRate: number;
  graceExitMinutes: number;
  effectiveFrom?: Date;
  maxMinutes: number;
  isActive: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const pricingConfigSchema = new Schema<PricingConfigDocument>(
  {
    dayRate: { type: Number, required: true, min: 0, default: 5000 },
    nightRate: { type: Number, required: true, min: 0, default: 10000 },
    dayStartHour: { type: Number, required: true, min: 0, max: 23, default: 6 },
    nightStartHour: { type: Number, required: true, min: 0, max: 23, default: 22 },
    gracePeriod: { type: Number, min: 0, default: 0 },
    freeMinutes: { type: Number, min: 0, default: 20 },
    hourlyRate: { type: Number, min: 0, default: 5000 },
    overnightRate: { type: Number, min: 0, default: 10000 },
    monthlyRate: { type: Number, min: 0, default: 1200000 },
    overdueFineRate: { type: Number, min: 0, default: 50000 },
    dailyMaxRate: { type: Number, min: 0, default: 120000 },
    graceExitMinutes: { type: Number, min: 0, default: 10 },
    effectiveFrom: { type: Date },
    maxMinutes: { type: Number, min: 0, default: 1440 },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const PricingConfig: Model<PricingConfigDocument> =
  mongoose.models.PricingConfig ||
  mongoose.model<PricingConfigDocument>("PricingConfig", pricingConfigSchema);

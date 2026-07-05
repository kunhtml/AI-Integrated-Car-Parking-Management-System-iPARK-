import mongoose, { Model, Schema } from "mongoose";

export type SubscriptionPlanDuration = "monthly" | "quarterly" | "yearly";

export type SubscriptionPlanDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  duration: SubscriptionPlanDuration;
  durationDays: number;
  price: number;
  maxVehicles?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const subscriptionPlanSchema = new Schema<SubscriptionPlanDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    duration: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      required: true,
    },
    durationDays: { type: Number, required: true },
    price: { type: Number, required: true },
    maxVehicles: { type: Number, default: -1 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const SubscriptionPlan: Model<SubscriptionPlanDocument> =
  mongoose.models.SubscriptionPlan ||
  mongoose.model<SubscriptionPlanDocument>("SubscriptionPlan", subscriptionPlanSchema);

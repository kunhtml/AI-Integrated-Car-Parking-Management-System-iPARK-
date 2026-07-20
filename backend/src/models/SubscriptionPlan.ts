import mongoose, { Model, Schema } from "mongoose";

export type SubscriptionPlanDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  duration: "monthly" | "quarterly" | "yearly";
  durationDays: number;
  price: number;
  maxVehicles: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const subscriptionPlanSchema = new Schema<SubscriptionPlanDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    duration: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      required: true,
      default: "monthly",
    },
    durationDays: { type: Number, required: true, min: 1, default: 30 },
    price: { type: Number, required: true, min: 0, default: 0 },
    maxVehicles: { type: Number, default: -1, min: -1 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const SubscriptionPlan: Model<SubscriptionPlanDocument> =
  mongoose.models.SubscriptionPlan ||
  mongoose.model<SubscriptionPlanDocument>("SubscriptionPlan", subscriptionPlanSchema);

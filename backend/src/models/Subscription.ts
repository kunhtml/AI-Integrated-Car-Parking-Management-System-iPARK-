import mongoose, { Model, Schema } from "mongoose";

export type SubscriptionStatus = "pending_payment" | "active" | "cancelled" | "expired";

export type SubscriptionDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planName: string;
  startDate: Date;
  endDate: Date;
  status: SubscriptionStatus;
  autoRenew: boolean;
  renewalCount: number;
  transactionId?: mongoose.Types.ObjectId;
  registeredVehicleIds?: mongoose.Types.ObjectId[];
  registeredPlates?: string[];
  createdAt: Date;
  updatedAt: Date;
};

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    planName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending_payment", "active", "cancelled", "expired"],
      default: "pending_payment",
      index: true,
    },
    autoRenew: { type: Boolean, default: false },
    renewalCount: { type: Number, default: 0 },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    registeredVehicleIds: [{ type: Schema.Types.ObjectId, ref: "Vehicle" }],
    registeredPlates: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

export const Subscription: Model<SubscriptionDocument> =
  mongoose.models.Subscription || mongoose.model<SubscriptionDocument>("Subscription", subscriptionSchema);

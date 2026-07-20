import mongoose, { Model, Schema } from "mongoose";

export type SubscriptionDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planName: string;
  startDate: Date;
  endDate: Date;
  status: "pending_payment" | "active" | "cancelled" | "expired";
  autoRenew: boolean;
  renewalCount: number;
  transactionId?: mongoose.Types.ObjectId;
  registeredVehicleIds: mongoose.Types.ObjectId[];
  registeredPlates?: string[];
  createdAt: Date;
  updatedAt: Date;
};

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    planName: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending_payment", "active", "cancelled", "expired"],
      default: "pending_payment",
      index: true,
    },
    autoRenew: { type: Boolean, default: false },
    renewalCount: { type: Number, default: 0, min: 0 },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    registeredVehicleIds: { type: [{ type: Schema.Types.ObjectId, ref: "Vehicle" }], default: [] },
    registeredPlates: [{ type: String, trim: true, uppercase: true }],
  },
  { timestamps: true },
);

subscriptionSchema.index({ userId: 1, status: 1, endDate: 1 });
subscriptionSchema.index({ registeredVehicleIds: 1, status: 1, endDate: 1 });
subscriptionSchema.index({ registeredPlates: 1, status: 1, endDate: 1 });

export const Subscription: Model<SubscriptionDocument> =
  mongoose.models.Subscription ||
  mongoose.model<SubscriptionDocument>("Subscription", subscriptionSchema);

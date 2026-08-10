import mongoose, { Model, Schema } from "mongoose";

export type SubscriptionStatus = "pending_payment" | "active" | "expired" | "cancelled";

export type SubscriptionDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planName: string;
  primaryVehicleId: mongoose.Types.ObjectId;
  memberCode: string;
  startDate: Date;
  endDate: Date;
  status: SubscriptionStatus;
  autoRenew: boolean;
  transactionId?: mongoose.Types.ObjectId;
  renewalCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    planName: { type: String, required: true },
    // Mỗi gói gắn với DUY NHẤT 1 xe. 1 user có thể có nhiều gói (mỗi xe 1 gói).
    primaryVehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      unique: true,
      index: true,
    },
    // Mã thành viên per-sub (mỗi xe có 1 mã riêng → quét QR ở cổng = nhận diện xe).
    memberCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending_payment", "active", "expired", "cancelled"],
      default: "active",
      index: true,
    },
    autoRenew: { type: Boolean, default: false },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    renewalCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });

export const Subscription: Model<SubscriptionDocument> =
  mongoose.models.Subscription ||
  mongoose.model<SubscriptionDocument>("Subscription", subscriptionSchema);

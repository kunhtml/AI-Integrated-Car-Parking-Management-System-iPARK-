import mongoose, { Model, Schema } from "mongoose";

export type SubscriptionStatus = "pending_payment" | "active" | "expired" | "cancelled";

export type SubscriptionDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planName: string;
  primaryVehicleId: mongoose.Types.ObjectId;
  /** RFID Member bán đứt, gắn 1-1 với xe của gói này. */
  rfidCardId?: mongoose.Types.ObjectId;
  memberCode: string;
  startDate: Date;
  endDate: Date;
  status: SubscriptionStatus;
  autoRenew: boolean;
  transactionId?: mongoose.Types.ObjectId;
  renewalCount: number;
  /** "Xe đang bị giữ bởi gói còn sống" — chỉ set khi status thuộc live set (xem partial index). */
  activeVehicleId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    planName: { type: String, required: true },
    // Mỗi gói gắn với 1 xe. 1 user có thể có nhiều gói (mỗi xe 1 gói).
    // Tính duy nhất "1 gói sống cho mỗi xe" do partial unique index trên
    // activeVehicleId đảm bảo (cuối file), KHÔNG còn unique trên primaryVehicleId
    // để gói đã hết hạn có thể được mua lại.
    primaryVehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    // Copy của primaryVehicleId chỉ tồn tại khi gói còn "sống"
    // (pending_payment / active / cancelled). Khi gói expired, field bị unset
    // → xe được phép mua gói mới.
    activeVehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      default: null,
    },
    rfidCardId: { type: Schema.Types.ObjectId, ref: "RfidCard", index: true },
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
// Chỉ MỘT gói "còn sống" (pending_payment/active/cancelled) cho mỗi xe.
// Gói expired không match partialFilterExpression → không giữ unique index
// → xe có thể mua gói mới mà không bị gói cũ chặn.
subscriptionSchema.index(
  { activeVehicleId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      status: { $in: ["pending_payment", "active", "cancelled"] },
    },
  },
);

export const Subscription: Model<SubscriptionDocument> =
  mongoose.models.Subscription ||
  mongoose.model<SubscriptionDocument>("Subscription", subscriptionSchema);

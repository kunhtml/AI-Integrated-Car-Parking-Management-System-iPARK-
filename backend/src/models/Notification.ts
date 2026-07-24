import mongoose, { Model, Schema } from "mongoose";

export type NotificationType =
  | "info"
  | "warning"
  | "error"
  | "success"
  | "subscription-expiry"
  | "capacity-warning"
  | "overstay"
  | "verification"
  | "payment"
  | "incident";

export type NotificationTargetRole = "admin" | "staff" | "customer" | "all";

export type NotificationDocument = {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  type: NotificationType;
  targetRole: NotificationTargetRole;
  targetUserId?: mongoose.Types.ObjectId;
  relatedSessionId?: mongoose.Types.ObjectId;
  relatedDeviceId?: mongoose.Types.ObjectId;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const notificationSchema = new Schema<NotificationDocument>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        "info",
        "warning",
        "error",
        "success",
        "subscription-expiry",
        "capacity-warning",
        "overstay",
        "verification",
        "payment",
        "incident",
      ],
      default: "info",
      index: true,
    },
    targetRole: {
      type: String,
      enum: ["admin", "staff", "customer", "all"],
      default: "all",
      index: true,
    },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    relatedSessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession" },
    relatedDeviceId: { type: Schema.Types.ObjectId, ref: "Device" },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true },
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ targetRole: 1, read: 1, createdAt: -1 });

export const Notification: Model<NotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<NotificationDocument>("Notification", notificationSchema);

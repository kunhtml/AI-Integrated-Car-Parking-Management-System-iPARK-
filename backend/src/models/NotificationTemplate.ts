import mongoose, { Model, Schema } from "mongoose";

export type NotificationTriggerType =
  | "entry"
  | "exit"
  | "overdue"
  | "low_balance"
  | "promotion"
  | "reservation_confirmed"
  | "reservation_expired"
  | "subscription_expiring"
  | "custom";

export type NotificationTemplateDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  triggerType: NotificationTriggerType;
  title: string;
  content: string;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const notificationTemplateSchema = new Schema<NotificationTemplateDocument>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    triggerType: {
      type: String,
      enum: [
        "entry",
        "exit",
        "overdue",
        "low_balance",
        "promotion",
        "reservation_confirmed",
        "reservation_expired",
        "subscription_expiring",
        "custom",
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const NotificationTemplate: Model<NotificationTemplateDocument> =
  mongoose.models.NotificationTemplate ||
  mongoose.model<NotificationTemplateDocument>("NotificationTemplate", notificationTemplateSchema);

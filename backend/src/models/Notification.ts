import mongoose, { Model, Schema } from "mongoose";
import type { UserRole } from "./User.js";

export type NotificationDocument = {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  targetRole: UserRole | "all";
  userId?: mongoose.Types.ObjectId;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
};

const notificationSchema = new Schema<NotificationDocument>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    targetRole: { type: String, enum: ["admin", "staff", "customer", "all"], default: "all", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

export const Notification: Model<NotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<NotificationDocument>("Notification", notificationSchema);

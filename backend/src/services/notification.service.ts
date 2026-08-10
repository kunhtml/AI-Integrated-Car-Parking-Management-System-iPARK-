import mongoose from "mongoose";
import { Notification } from "../models/Notification.js";
import type { UserRole } from "../models/User.js";

export async function createNotification(values: {
  title: string;
  content: string;
  targetRole?: UserRole | "all";
  userId?: string;
}) {
  return Notification.create({
    title: values.title,
    content: values.content,
    targetRole: values.targetRole || "all",
    ...(values.userId && mongoose.isValidObjectId(values.userId)
      ? { userId: new mongoose.Types.ObjectId(values.userId) }
      : {}),
  });
}

import mongoose from "mongoose";
import { Notification } from "../models/Notification.js";
import type { UserRole } from "../models/User.js";

export async function createNotification(values: {
  title: string;
  content: string;
  type?: string;
  targetRole?: UserRole | "all";
  userId?: string;
  targetUserId?: string;
}) {
  return Notification.create({
    title: values.title,
    content: values.content,
    type: values.type,
    targetRole: values.targetRole || "all",
    ...((values.userId || values.targetUserId) && mongoose.isValidObjectId(values.userId || values.targetUserId || "")
      ? { userId: new mongoose.Types.ObjectId(values.userId || values.targetUserId!) }
      : {}),
  });
}

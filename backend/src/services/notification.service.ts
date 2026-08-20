import mongoose from "mongoose";
import { Notification } from "../models/Notification.js";
import { User, type UserRole } from "../models/User.js";

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


export async function createNotificationsForRoles(values: {
  title: string;
  content: string;
  type?: string;
  roles: UserRole[];
}) {
  const users = await User.find({
    role: { $in: values.roles },
    status: "Đang hoạt động",
  }).select("_id role").lean();

  if (users.length === 0) return 0;

  await Notification.insertMany(users.map((user) => ({
    title: values.title,
    content: values.content,
    type: values.type,
    targetRole: user.role,
    userId: user._id,
  })));
  return users.length;
}

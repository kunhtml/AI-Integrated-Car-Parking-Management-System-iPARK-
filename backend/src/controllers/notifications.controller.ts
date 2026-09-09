import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Notification, NotificationDocument } from "../models/Notification.js";
import { serializeNotification } from "../utils/serializers.js";
import { createNotificationsForRoles } from "../services/notification.service.js";

export async function listNotifications(request: Request, response: Response) {
  const userId = request.user?.id;
  const userRole = request.user?.role;
  const userObjId = mongoose.isValidObjectId(userId)
    ? new mongoose.Types.ObjectId(userId)
    : null;

  const baseQuery: any = {
    $or: [
      ...(userObjId ? [{ userId: userObjId }] : []),
      ...(userId ? [{ userId }] : []),
      ...(userRole
        ? [
            { targetRole: { $in: [userRole, "all"] }, userId: { $exists: false } },
            { targetRole: { $in: [userRole, "all"] }, userId: null },
          ]
        : [
            { targetRole: "all", userId: { $exists: false } },
            { targetRole: "all", userId: null },
          ]),
    ],
  };

  const status = request.query.status as string | undefined;
  const query: any = { ...baseQuery };

  if (status === "unread") {
    query.readBy = userObjId ? { $ne: userObjId } : { $ne: userId };
  } else if (status === "read") {
    query.readBy = userObjId || userId;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).limit(100),
    Notification.countDocuments(baseQuery),
    Notification.countDocuments({
      ...baseQuery,
      readBy: userObjId ? { $ne: userObjId } : { $ne: userId },
    }),
  ]);
  const readCount = Math.max(0, total - unreadCount);

  response.json({
    notifications: notifications.map((notification) =>
      serializeNotification(notification, userId),
    ),
    total,
    unreadCount,
    readCount,
  });
}

export async function createNotificationController(request: Request, response: Response) {
  const body = z
    .object({
      title: z.string().min(2),
      content: z.string().min(2),
      targetRole: z.enum(["admin", "staff", "customer", "all"]).default("all"),
    })
    .parse(request.body);
  const roles = body.targetRole === "all"
    ? ["admin", "staff", "customer"] as const
    : [body.targetRole];
  const created = await createNotificationsForRoles({
    title: body.title,
    content: body.content,
    roles: [...roles],
  });
  response.status(201).json({ created });
}

export async function markNotificationRead(request: Request, response: Response) {
  const userId = request.user?.id;
  const userRole = request.user?.role;
  const userObjId = mongoose.isValidObjectId(userId)
    ? new mongoose.Types.ObjectId(userId)
    : null;

  const notifId = request.params.id;
  if (!mongoose.isValidObjectId(notifId)) {
    response.status(400).json({ message: "ID thông báo không hợp lệ." });
    return;
  }

  const filter: any = {
    _id: notifId,
    $or: [
      ...(userObjId ? [{ userId: userObjId }] : []),
      ...(userId ? [{ userId }] : []),
      ...(userRole
        ? [
            { targetRole: { $in: [userRole, "all"] }, userId: { $exists: false } },
            { targetRole: { $in: [userRole, "all"] }, userId: null },
          ]
        : []),
    ],
  };

  const notification = await Notification.findOneAndUpdate(
    filter,
    { $addToSet: { readBy: userObjId || userId } },
    { returnDocument: "after" },
  );
  if (!notification) {
    response.status(404).json({ message: "Không tìm thấy thông báo." });
    return;
  }

  response.json({
    notification: serializeNotification(
      notification as NotificationDocument,
      userId,
    ),
  });
}

// CU-26: Send promotion to all customers
export async function sendPromotionHandler(request: Request, response: Response) {
  const body = z
    .object({
      title: z.string().min(2),
      content: z.string().min(2),
    })
    .parse(request.body);

  const { notifyPromotion } = await import("../services/notificationTriggers.service.js");
  await notifyPromotion(body.title, body.content);

  response.json({ ok: true, message: "Đã gửi thông báo khuyến mãi đến tất cả khách hàng." });
}

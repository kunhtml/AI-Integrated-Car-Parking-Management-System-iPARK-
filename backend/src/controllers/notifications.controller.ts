import { Request, Response } from "express";
import { z } from "zod";
import { Notification } from "../models/Notification.js";
import { serializeNotification } from "../utils/serializers.js";
import { createNotificationsForRoles } from "../services/notification.service.js";

export async function listNotifications(request: Request, response: Response) {
  const notifications = await Notification.find({ userId: request.user?.id })
    .sort({ createdAt: -1 })
    .limit(100);

  response.json({
    notifications: notifications.map((notification) =>
      serializeNotification(notification, request.user?.id),
    ),
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
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.id, userId: request.user?.id },
    { $addToSet: { readBy: request.user?.id } },
    { returnDocument: "after" },
  );
  if (!notification) {
    response.status(404).json({ message: "Không tìm thấy thông báo." });
    return;
  }

  response.json({ notification: serializeNotification(notification, request.user?.id) });
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

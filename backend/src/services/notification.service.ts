import {
  Notification,
  type NotificationType,
  type NotificationTargetRole,
} from "../models/Notification.js";

interface CreateNotificationOpts {
  title: string;
  content: string;
  type?: NotificationType;
  targetRole?: NotificationTargetRole;
  targetUserId?: string;
  relatedSessionId?: string;
  relatedDeviceId?: string;
}

export async function createNotification(opts: CreateNotificationOpts) {
  try {
    const notification = await Notification.create({
      title: opts.title,
      content: opts.content,
      type: opts.type || "info",
      targetRole: opts.targetRole || "all",
      targetUserId: opts.targetUserId,
      relatedSessionId: opts.relatedSessionId,
      relatedDeviceId: opts.relatedDeviceId,
    });

    // Also publish realtime event for live updates
    try {
      const { publishRealtime } = await import("./realtime.service.js");
      publishRealtime("notification", {
        id: notification._id.toString(),
        title: notification.title,
        content: notification.content,
        type: notification.type,
        targetRole: notification.targetRole,
        read: false,
        createdAt: notification.createdAt,
      });
    } catch {
      // realtime service not available
    }

    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function listNotifications(opts?: {
  targetRole?: string;
  userId?: string;
  unreadOnly?: boolean;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};

  if (opts?.targetRole && opts.targetRole !== "all") {
    filter.$or = [
      { targetRole: opts.targetRole },
      { targetRole: "all" },
    ];
  }

  if (opts?.userId) {
    filter.$or = [
      ...(filter.$or as Array<Record<string, unknown>>) || [],
      { targetUserId: opts.userId },
      { targetUserId: { $exists: false } },
    ];
  }

  if (opts?.unreadOnly) {
    filter.read = false;
  }

  return Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(opts?.limit || 100)
    .lean();
}

export async function markNotificationRead(id: string) {
  return Notification.findByIdAndUpdate(
    id,
    { read: true, readAt: new Date() },
    { new: true },
  );
}

export async function markAllNotificationsRead(targetRole?: string) {
  const filter: Record<string, unknown> = { read: false };
  if (targetRole) {
    filter.$or = [{ targetRole }, { targetRole: "all" }];
  }
  return Notification.updateMany(filter, {
    read: true,
    readAt: new Date(),
  });
}

export async function getUnreadCount(
  targetRole?: string,
): Promise<number> {
  const filter: Record<string, unknown> = { read: false };
  if (targetRole) {
    filter.$or = [{ targetRole }, { targetRole: "all" }];
  }
  return Notification.countDocuments(filter);
}

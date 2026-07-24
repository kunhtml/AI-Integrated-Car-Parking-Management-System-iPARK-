import { Subscription } from "../models/Subscription.js";
import { Notification } from "../models/Notification.js";
import { createNotification } from "./notification.service.js";

/**
 * UC22 - Subscription Expiry Warning
 *
 * Find active subscriptions expiring within 7 days and create
 * notifications for their owners. Avoids duplicates by checking
 * if a notification was already sent in the last 24 hours.
 */
export async function checkExpiringSubscriptions(): Promise<{
  checked: number;
  warned: number;
}> {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const expiringSubs = await Subscription.find({
    status: "active",
    endDate: { $lte: sevenDaysLater, $gt: now },
  });

  let warned = 0;

  for (const sub of expiringSubs) {
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const existingNotification = await Notification.findOne({
      type: "subscription-expiry",
      targetUserId: sub.userId,
      createdAt: { $gte: twentyFourHoursAgo },
    });

    if (existingNotification) {
      continue;
    }

    const daysRemaining = Math.ceil(
      (sub.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );

    await createNotification({
      title: "Gói đăng ký sắp hết hạn",
      content: `Gói "${sub.planName}" của bạn sẽ hết hạn sau ${daysRemaining} ngày (${sub.endDate.toLocaleDateString("vi-VN")}). Vui lòng gia hạn để tiếp tục sử dụng dịch vụ.`,
      type: "subscription-expiry",
      targetRole: "customer",
      targetUserId: sub.userId.toString(),
    });

    warned++;
  }

  return { checked: expiringSubs.length, warned };
}

/**
 * UC22 - Subscription Expiry Warning
 *
 * Find subscriptions past their endDate that are still active and
 * update them to "expired". Create notifications for affected users.
 */
export async function checkExpiredSubscriptions(): Promise<{
  expired: number;
}> {
  const now = new Date();

  const expiredSubs = await Subscription.find({
    status: "active",
    endDate: { $lte: now },
  });

  let expiredCount = 0;

  for (const sub of expiredSubs) {
    sub.status = "expired";
    await sub.save();

    await createNotification({
      title: "Gói đăng ký đã hết hạn",
      content: `Gói "${sub.planName}" của bạn đã hết hạn vào ngày ${sub.endDate.toLocaleDateString("vi-VN")}. Vui lòng đăng ký lại để tiếp tục sử dụng dịch vụ.`,
      type: "subscription-expiry",
      targetRole: "customer",
      targetUserId: sub.userId.toString(),
    });

    expiredCount++;
  }

  return { expired: expiredCount };
}

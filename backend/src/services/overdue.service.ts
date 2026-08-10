import mongoose from "mongoose";
import { ParkingSession } from "../models/ParkingSession.js";
import { PricingConfig } from "../models/PricingConfig.js";
import { getActivePricingConfig, OVERDUE_FINE_RATE } from "./pricing.service.js";
import { notifyPenalty } from "./notificationTriggers.service.js";
import { createNotification } from "./notification.service.js";

/**
 * PM-05 + CF-03: Calculate overdue fine for a session.
 * Mức phạt cố định OVERDUE_FINE_RATE (VND / 30 phút).
 * Grace period: additional minutes allowed after checkout time before fine kicks in.
 */
export function calculateOverdueFine(
  checkInAt: Date,
  now: Date,
  config: { gracePeriod?: number },
  maxAllowedMinutes?: number,
): { isOverstayed: boolean; overdueMinutes: number; fineAmount: number } {
  const totalMinutes = Math.ceil((now.getTime() - checkInAt.getTime()) / 60000);
  const grace = config.gracePeriod ?? 0;
  // Max allowed = configured max or 24 hours default
  const maxMinutes = maxAllowedMinutes ?? 1440;
  const threshold = maxMinutes + grace;

  if (totalMinutes <= threshold) {
    return { isOverstayed: false, overdueMinutes: 0, fineAmount: 0 };
  }

  const overdueMinutes = totalMinutes - threshold;
  // Fine per 30 minutes overdue
  const fineUnits = Math.ceil(overdueMinutes / 30);
  const fineAmount = fineUnits * OVERDUE_FINE_RATE;

  return { isOverstayed: true, overdueMinutes, fineAmount };
}

/**
 * Scan all active sessions and flag overdue ones.
 * Sends penalty notifications to owners.
 */
export async function scanAndFlagOverdueSessions(): Promise<number> {
  const config = await getActivePricingConfig();
  const now = new Date();
  const maxMinutes = (config as any).maxMinutes || 1440; // 24h default

  // Find sessions that have been active too long
  const cutoff = new Date(now.getTime() - (maxMinutes + (config as any).gracePeriod || 0) * 60000);
  const overdueSessions = await ParkingSession.find({
    status: "Đang gửi",
    isOverstayed: { $ne: true },
    checkInAt: { $lt: cutoff },
  });

  let flagged = 0;
  for (const session of overdueSessions) {
    const result = calculateOverdueFine(session.checkInAt, now, {
      gracePeriod: (config as any).gracePeriod ?? 0,
    }, maxMinutes);

    if (result.isOverstayed) {
      session.isOverstayed = true;
      session.overdueMinutes = result.overdueMinutes;
      await session.save();

      // CU-24: Notify owner
      if (session.ownerUserId) {
        await notifyPenalty(
          session.ownerUserId.toString(),
          session.plate,
          result.overdueMinutes,
          result.fineAmount,
        );
      }
      flagged++;
    }
  }

  if (flagged > 0) {
    await createNotification({
      title: "Phiên quá hạn",
      content: `${flagged} phiên đỗ xe đã quá hạn cho phép.`,
      targetRole: "admin",
    });
  }

  return flagged;
}

/**
 * ST-13: Waive penalty for a session (admin/staff action).
 */
export async function waivePenalty(
  sessionId: string,
  staffId: string,
  reason: string,
): Promise<void> {
  const session = await ParkingSession.findById(sessionId);
  if (!session) {
    const err = new Error("Phiên không tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  session.isOverstayed = false;
  session.overdueMinutes = 0;
  session.discountReason = `Miễn phạt: ${reason}`;
  session.notes = `Miễn phạt bởi staff ${staffId}: ${reason}`;
  await session.save();
}

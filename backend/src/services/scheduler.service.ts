import { Cron } from "croner";
import {
  expirePendingSubscriptionPayments,
  expireSubscriptions,
  renewSubscription,
} from "./subscription.service.js";
import { Subscription } from "../models/Subscription.js";
import { expireOverdueReservations } from "./reservation.service.js";
import { checkOfflineDevices } from "./deviceMaintenance.service.js";
import { scanAndFlagOverdueSessions } from "./overdue.service.js";
import { sendExpiryReminders, sendPrepaidReminders } from "./reminder.service.js";
import { reconcileStaleSlots } from "./parkingSlot.service.js";
import { reconcilePendingRfidSales } from "./rfidSales.service.js";

/**
 * Initialize all background scheduled tasks.
 * Called once when the server starts.
 *
 * Croner dùng `protect: true` để tự chạy bù job bị miss (thay vì log cảnh báo như node-cron).
 * `unref: true` để job không giữ event loop khi tắt server.
 */
export function initScheduler() {
  console.log("[Scheduler] Initializing background jobs...");

  // Every 5 minutes: check for expired subscriptions and auto-renew
  new Cron("*/5 * * * *", { protect: true, unref: true }, async () => {
    try {
      // Auto-renew subscriptions with autoRenew=true that are expiring
      const expiringAutoRenew = await Subscription.find({
        status: "active",
        autoRenew: true,
        endDate: { $lt: new Date(Date.now() + 24 * 60 * 60 * 1000) }, // expiring within 24h
      });

      for (const sub of expiringAutoRenew) {
        try {
          await renewSubscription(sub._id.toString());
          console.log(`[Scheduler] Auto-renewed subscription ${sub._id}`);
        } catch (err) {
          console.error(`[Scheduler] Failed to auto-renew ${sub._id}:`, err);
        }
      }

      // Expire subscriptions past endDate
      const expired = await expireSubscriptions();
      if (expired > 0) {
        console.log(`[Scheduler] Expired ${expired} subscriptions`);
      }

      // Send expiry reminders for parking sessions
      const reminderCount = await sendExpiryReminders();
      if (reminderCount > 0) {
        console.log(`[Scheduler] Sent ${reminderCount} expiry reminders`);
      }

      // Send prepaid reminders
      const prepaidCount = await sendPrepaidReminders();
      if (prepaidCount > 0) {
        console.log(`[Scheduler] Sent ${prepaidCount} prepaid reminders`);
      }
    } catch (err) {
      console.error("[Scheduler] Subscription job error:", err);
    }
  });

  // Every minute: reconcile paid RFID sales when PayOS webhook cannot reach localhost.
  new Cron("* * * * *", { protect: true, unref: true }, async () => {
    try {
      const expiredPending = await expirePendingSubscriptionPayments();
      if (expiredPending > 0) {
        console.log(`[Scheduler] Expired ${expiredPending} unpaid subscription order(s)`);
      }
      const result = await reconcilePendingRfidSales();
      if (result.updated > 0) {
        console.log(`[Scheduler] Activated ${result.updated} paid RFID sales (checked=${result.checked})`);
      }
    } catch (err) {
      console.error("[Scheduler] RFID payment reconciliation error:", err);
    }
  });

  // Every 10 minutes: expire overdue reservations + dọn slot bị kẹt
  new Cron("*/10 * * * *", { protect: true, unref: true }, async () => {
    try {
      const count = await expireOverdueReservations();
      if (count > 0) console.log(`[Scheduler] Expired ${count} reservations`);
    } catch (err) {
      console.error("[Scheduler] Reservation expire error:", err);
    }
    try {
      const freed = await reconcileStaleSlots();
      if (freed > 0) console.log(`[Scheduler] Freed ${freed} stale slots`);
    } catch (err) {
      console.error("[Scheduler] Stale slot reconcile error:", err);
    }
  });

  // Every 15 minutes: check offline devices
  new Cron("*/15 * * * *", { protect: true, unref: true }, async () => {
    try {
      const count = await checkOfflineDevices();
      if (count > 0) console.log(`[Scheduler] Marked ${count} devices offline`);
    } catch (err) {
      console.error("[Scheduler] Device health check error:", err);
    }
  });

  // Every 30 minutes: scan for overdue parking sessions
  new Cron("*/30 * * * *", { protect: true, unref: true }, async () => {
    try {
      const count = await scanAndFlagOverdueSessions();
      if (count > 0) console.log(`[Scheduler] Flagged ${count} overdue sessions`);
    } catch (err) {
      console.error("[Scheduler] Overdue scan error:", err);
    }
  });

  console.log("[Scheduler] All jobs registered.");
}

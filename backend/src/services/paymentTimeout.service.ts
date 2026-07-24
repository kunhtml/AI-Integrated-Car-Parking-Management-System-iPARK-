import { Transaction } from "../models/Transaction.js";

// Try to import PayOS functions dynamically; they may not be available in all environments.
let checkPayOSPaymentStatus: ((orderCode: string) => Promise<{ status: string; message?: string }>) | null = null;
let cancelPayOSPaymentLink: ((orderCode: string) => Promise<{ success: boolean; error?: string }>) | null = null;

async function loadPayOSFunctions() {
  if (checkPayOSPaymentStatus && cancelPayOSPaymentLink) {
    return;
  }
  try {
    const payos = await import("./payos.service.js");
    checkPayOSPaymentStatus = payos.checkPayOSPaymentStatus;
    cancelPayOSPaymentLink = payos.cancelPayOSPaymentLink;
  } catch {
    console.warn("[payment-timeout] PayOS service not available, will rely on age-based timeout only.");
  }
}

/** 30 minutes in ms */
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
/** 2 hours in ms */
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export type CheckPendingResult = {
  checked: number;
  expired: number;
  cancelled: number;
};

/**
 * Check all pending transactions older than 30 minutes.
 * - If the transaction has a payosOrderCode, check its status via PayOS.
 *   Update our status to match (paid/cancelled/expired).
 * - If still pending and older than 2 hours, auto-cancel.
 * Returns counts of checked, expired, and cancelled transactions.
 */
export async function checkPendingTransactions(): Promise<CheckPendingResult> {
  await loadPayOSFunctions();

  const cutoff = new Date(Date.now() - THIRTY_MINUTES_MS);

  const pendingTransactions = await Transaction.find({
    status: "pending",
    createdAt: { $lt: cutoff },
  });

  let checked = 0;
  let expired = 0;
  let cancelled = 0;

  for (const txn of pendingTransactions) {
    checked++;
    const ageMs = Date.now() - new Date(txn.createdAt).getTime();

    // If the transaction has a PayOS order code, try to check its real status
    if (txn.payosOrderCode && checkPayOSPaymentStatus) {
      try {
        const result = await checkPayOSPaymentStatus(txn.payosOrderCode);

        if (result.status === "paid") {
          txn.status = "paid";
          txn.paidAt = new Date();
          await txn.save();
          continue;
        }

        if (result.status === "cancelled") {
          txn.status = "cancelled";
          txn.note = (txn.note ? txn.note + " | " : "") + "Hủy bởi PayOS";
          await txn.save();
          expired++;
          continue;
        }

        // status === "pending" from PayOS — fall through to age-based check
      } catch (error) {
        console.error(
          `[payment-timeout] Error checking PayOS for orderCode ${txn.payosOrderCode}:`,
          error,
        );
        // Fall through to age-based cancellation
      }
    }

    // Auto-cancel if older than 2 hours and still pending
    if (ageMs > TWO_HOURS_MS) {
      txn.status = "cancelled";
      txn.note = (txn.note ? txn.note + " | " : "") + "Tự động hủy do quá hạn thanh toán (2 giờ)";

      // If the transaction has a PayOS link, try to cancel it on PayOS side too
      if (txn.payosOrderCode && cancelPayOSPaymentLink) {
        try {
          await cancelPayOSPaymentLink(txn.payosOrderCode);
        } catch (error) {
          console.error(
            `[payment-timeout] Error cancelling PayOS link for orderCode ${txn.payosOrderCode}:`,
            error,
          );
        }
      }

      await txn.save();
      cancelled++;
    }
  }

  return { checked, expired, cancelled };
}

/**
 * Count pending transactions older than 30 minutes.
 */
export async function getPendingTransactionsCount(): Promise<number> {
  const cutoff = new Date(Date.now() - THIRTY_MINUTES_MS);
  return Transaction.countDocuments({
    status: "pending",
    createdAt: { $lt: cutoff },
  });
}

import { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import { Transaction } from "../models/Transaction.js";
import type { TransactionDocument } from "../models/Transaction.js";
import { ParkingSession } from "../models/ParkingSession.js";
import type { ParkingSessionDocument } from "../models/ParkingSession.js";
import { verifyWebhookSignature, checkPayOSPaymentStatus } from "../services/payos.service.js";
import { sendMail } from "./mail.service.js";

type HydratedSession = HydratedDocument<ParkingSessionDocument>;

/**
 * Áp dụng một giao dịch đã thanh toán vào phiên gửi xe.
 * Dùng chung cho webhook (PayOS chủ động báo) và reconcile (server chủ động hỏi PayOS).
 * Idempotent ở tầng gọi: chỉ gọi khi transaction vừa chuyển sang "paid".
 *
 * QUAN TRỌNG: thanh toán KHÔNG đồng nghĩa với checkout. Khách có thể trả trước
 * khi xe vẫn đang gửi để lúc ra chỉ việc lấy xe. Vì vậy chỉ ghi nhận tiền;
 * chỉ hoàn tất phiên + nhả slot khi xe đã thật sự ra bãi (camera/nút checkout
 * đã đặt status = "Đã hoàn thành" trước đó).
 */
async function applyPaidTransactionToSession(
  transaction: TransactionDocument,
  session: HydratedSession,
) {
  session.paidAmount = (session.paidAmount || 0) + transaction.amount;
  session.paymentStatus = session.paidAmount >= (session.fee || 0) ? "fully_paid" : "partial_paid";

  // Chỉ nhả slot + chốt giờ ra khi xe đã ra bãi (phiên đã hoàn thành từ trước).
  if (session.status === "Đã hoàn thành") {
    if (!session.checkOutAt) session.checkOutAt = new Date();
    const { freeSlot } = await import("../services/parkingSlot.service.js");
    if (session.slotId) {
      await freeSlot(session.slotId);
    }
  }

  await session.save();

  sendPaymentConfirmationEmail(transaction, session);
  console.log(`[PayOS] Session ${session._id} payment recorded (status=${session.status}).`);
}

/**
 * Chủ động hỏi PayOS xem các giao dịch pending của phiên đã thanh toán chưa.
 * Cần thiết cho môi trường localhost nơi webhook không thể gọi tới server.
 * Trả về true nếu có ít nhất một giao dịch vừa được xác nhận đã thanh toán.
 */
export async function reconcileSessionPayment(
  session: HydratedSession,
): Promise<boolean> {
  const pending = await Transaction.find({
    sessionId: session._id,
    status: "pending",
    payosOrderCode: { $exists: true, $ne: null },
  });

  let applied = false;
  for (const transaction of pending) {
    const result = await checkPayOSPaymentStatus(String(transaction.payosOrderCode));
    if (result.status !== "paid") continue;

    transaction.status = "paid";
    transaction.paidAt = new Date();
    transaction.gateway = "payos";
    await transaction.save();

    await applyPaidTransactionToSession(transaction, session);
    applied = true;
  }
  return applied;
}

/**
 * PayOS Webhook - Nhận thông báo thanh toán tự động
 * PayOS sẽ gọi endpoint này ngay khi có thanh toán thành công
 */
export async function handlePayOSWebhook(request: Request, response: Response) {
  try {
    const webhookData = request.body;

    // Log webhook data for debugging
    console.log("[PayOS Webhook] Received:", JSON.stringify(webhookData, null, 2));

    // Get checksum key from env (đồng bộ với getPayOSConfig: PAYTOS_*)
    const checksumKey = process.env.PAYTOS_CHECKSUM_KEY;
    const isDev = process.env.NODE_ENV !== "production";

    if (!checksumKey) {
      if (!isDev) {
        console.error("[PayOS Webhook] Checksum key not configured");
        response.status(500).json({ message: "Server configuration error" });
        return;
      }
      console.warn("[PayOS Webhook] Checksum key not configured - skipping verification in dev mode");
    } else {
      // Verify signature
      const isValid = verifyWebhookSignature(webhookData, checksumKey);
      if (!isValid) {
        console.warn("[PayOS Webhook] Invalid signature");
        if (!isDev) {
          response.status(400).json({ message: "Invalid signature" });
          return;
        }
        console.warn("[PayOS Webhook] Proceeding anyway in dev mode");
      }
    }

    // Check if payment successful
    if (webhookData.code !== "00" || !webhookData.success) {
      console.log("[PayOS Webhook] Payment not successful:", webhookData.desc);
      response.json({ message: "Payment not successful" });
      return;
    }

    const { orderCode, amount, description: payosDescription } = webhookData.data;

    // Extract sessionId from PayOS description (format: "iPARK <last6>")
    let session = null;
    if (payosDescription) {
      // description is like "iPARK abc123" where abc123 is last 6 of sessionId
      const match = payosDescription.match(/\S+\s+(\S+)$/);
      const last6 = match?.[1];
      if (last6) {
        // Find session by _id ending with last6 chars
        const sessions = await ParkingSession.find({ _id: { $regex: `${last6}$` } }).limit(5);
        session = sessions.length === 1 ? sessions[0] : null;
        if (!session) console.warn("[PayOS Webhook] Could not resolve session from description:", payosDescription);
      }
    }

    // Find or create transaction by payosOrderCode
    let transaction = await Transaction.findOne({ payosOrderCode: String(orderCode) });

    if (transaction) {
      // Idempotent: already processed
      if (transaction.status === "paid") {
        console.log("[PayOS Webhook] Already paid, skipping:", orderCode);
        response.json({ message: "Already processed" });
        return;
      }
      // Pending record exists → just update to paid
    } else {
      // No existing record → webhook creates the Transaction directly
      // Use try/catch for race condition safety (unique index on payosOrderCode)
      try {
        transaction = await Transaction.create({
          payosOrderCode: String(orderCode),
          sessionId: session?._id || undefined,
          method: "payos",
          amount,
          status: "paid",
          paidAt: new Date(),
          bankTransactionId: webhookData.data.reference || String(orderCode),
          gateway: "payos",
        });
        console.log("[PayOS Webhook] Created Transaction from webhook:", transaction._id);
      } catch (err: any) {
        if (err.code === 11000) {
          console.log("[PayOS Webhook] Duplicate orderCode race condition, skipping:", orderCode);
          response.json({ message: "Already processed" });
          return;
        }
        throw err;
      }
    }

    // Update to paid (handles both newly created and existing pending)
    transaction.status = "paid";
    transaction.paidAt = new Date();
    transaction.bankTransactionId = webhookData.data.reference || String(orderCode);
    transaction.gateway = "payos";
    if (session && !transaction.sessionId) transaction.sessionId = session._id;
    await transaction.save();

    // Giao dịch mua/gia hạn gói thành viên → kích hoạt / cộng ngày
    if (transaction.subscriptionId) {
      const { applyPaidSubscriptionTransaction } = await import("./subscription.service.js");
      await applyPaidSubscriptionTransaction(transaction);
      console.log(`[PayOS Webhook] Subscription ${transaction.subscriptionId} payment applied.`);
      response.json({ message: "Subscription payment applied" });
      return;
    }

    // Update parking session - mark as paid and set checkOutAt
    if (session) {
      await applyPaidTransactionToSession(transaction, session);
    } else {
      console.warn("[PayOS Webhook] Could not resolve parking session for transaction:", transaction._id);
    }

    console.log(`[PayOS Webhook] Payment confirmed for orderCode: ${orderCode}`);
    response.json({ message: "Payment confirmed successfully" });
  } catch (error) {
    console.error("[PayOS Webhook] Error processing webhook:", error);
    response.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Send payment confirmation email
 */
async function sendPaymentConfirmationEmail(transaction: any, session: any) {
  try {
    let email: string | null = session?.ownerEmail || null;

    if (!email && session?.ownerUserId) {
      const { User } = await import("../models/User.js");
      const user = await User.findById(session.ownerUserId);
      email = user?.email || null;
    }

    if (!email) {
      const { Vehicle } = await import("../models/Vehicle.js");
      const vehicle = await Vehicle.findOne({ plate: session?.plate });
      email = (vehicle as any)?.ownerEmail || null;
    }

    if (!email) {
      console.log("[PayOS Webhook] No email found for transaction:", transaction._id);
      return;
    }

    const plate = session?.plate || "Unknown";
    const amount = transaction?.amount || session?.fee || 0;
    const checkInAt = session?.checkInAt
      ? new Date(session.checkInAt).toLocaleString("vi-VN", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "—";
    const checkoutAt = session?.prepaidCheckoutAt
      ? new Date(session.prepaidCheckoutAt).toLocaleString("vi-VN", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : session?.checkOutAt
        ? new Date(session.checkOutAt).toLocaleString("vi-VN", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })
        : "—";
    const paidAt = transaction?.paidAt
      ? new Date(transaction.paidAt).toLocaleString("vi-VN", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : new Date().toLocaleString("vi-VN", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
    const transactionId = transaction?._id?.toString?.() || transaction?.bankTransactionId || "—";
    const slot = session?.slot || "—";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận thanh toán iPARK</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#1a56db;padding:28px 32px;text-align:center;">
      <div style="font-size:28px;font-weight:bold;color:#ffffff;letter-spacing:1px;">iPARK</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Xác nhận thanh toán gửi xe</div>
    </div>

    <!-- Status badge -->
    <div style="text-align:center;padding:24px 32px 0;">
      <div style="display:inline-block;background:#dcfce7;color:#15803d;font-size:13px;font-weight:600;padding:8px 20px;border-radius:99px;">
        Thanh toán thành công
      </div>
    </div>

    <!-- Info card -->
    <div style="margin:24px 32px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">Biên lai thanh toán</div>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#6b7280;">Biển số xe</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${plate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#6b7280;">Vị trí đỗ</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${slot}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#6b7280;">Giờ vào</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${checkInAt}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#6b7280;">Giờ checkout dự kiến</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${checkoutAt}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#6b7280;">Thời gian thanh toán</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${paidAt}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#6b7280;">Mã giao dịch</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${transactionId}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:16px;"><hr style="border:none;border-top:1px solid #e5e7eb;"></td>
        </tr>
        <tr>
          <td style="padding:12px 0;font-size:16px;font-weight:700;color:#111827;">Tổng thanh toán</td>
          <td style="padding:12px 0;font-size:20px;font-weight:700;color:#1a56db;text-align:right;">${amount.toLocaleString("vi-VN")}đ</td>
        </tr>
      </table>
    </div>

    <!-- Notice -->
    <div style="margin:0 32px 24px;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
      <div style="font-size:13px;color:#1e40af;line-height:1.6;">
        <strong>Xe của bạn đã được thanh toán.</strong> Có thể ra bãi bất kỳ lúc nào trước thời gian checkout dự kiến. Nếu cần gia hạn thêm, vui lòng tra cứu tại website.
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:0 32px 28px;font-size:12px;color:#9ca3af;">
      Cảm ơn bạn đã sử dụng dịch vụ iPARK.<br>
      Liên hệ hotro@ipark.vn nếu cần hỗ trợ.
    </div>
  </div>
</body>
</html>`;

    const text = `Thanh toán thành công!

BIÊN LAI THANH TOÁN iPARK
━━━━━━━━━━━━━━━━━━━━━
Biển số xe:          ${plate}
Vị trí đỗ:           ${slot}
Giờ vào:             ${checkInAt}
Giờ checkout dự kiến: ${checkoutAt}
Thời gian thanh toán: ${paidAt}
Mã giao dịch:        ${transactionId}
━━━━━━━━━━━━━━━━━━━━━
Tổng thanh toán:     ${amount.toLocaleString("vi-VN")}đ

Xe của bạn đã được thanh toán. Có thể ra bãi bất kỳ lúc nào!
Liên hệ hotro@ipark.vn nếu cần hỗ trợ.`;

    await sendMail(
      email,
      `[iPARK] Xác nhận thanh toán thành công - Xe ${plate}`,
      text,
      html,
    );

    console.log("[PayOS Webhook] Confirmation email sent to:", email);
  } catch (error) {
    console.error("[PayOS Webhook] Failed to send email:", error);
  }
}

/**
 * Handle return from PayOS (after user completes or cancels payment)
 */
export async function handlePayOSReturn(request: Request, response: Response) {
  try {
    const { orderCode, code, status } = request.query;

    console.log("[PayOS Return] Received:", { orderCode, code, status });

    // Redirect to frontend with result
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    // Determine payment status
    const isSuccess = code === "00" || status === "PAID" || status === "COMPLETED";
    
    if (isSuccess) {
      // Payment successful - redirect to frontend with success status
      response.redirect(`${frontendUrl}?payos_status=success&orderCode=${orderCode}`);
    } else {
      // Payment failed or cancelled - redirect to frontend with cancel status
      response.redirect(`${frontendUrl}?payos_status=cancelled&orderCode=${orderCode}`);
    }
  } catch (error) {
    console.error("[PayOS Return] Error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    response.redirect(`${frontendUrl}?payos_status=error`);
  }
}

import { Request, Response } from "express";
import { ParkingSession } from "../models/ParkingSession.js";
import { RfidCard } from "../models/RfidCard.js";
import { ParkingCameraLog } from "../models/ParkingCameraLog.js";
import { findActiveSubscriptionByPlate } from "../services/subscription.service.js";
import { calculateParkingFee } from "../services/pricing.service.js";
import { getActivePricingConfig } from "../services/pricing.service.js";
import { env } from "../config/env.js";

/**
 * Backend POST /api/exit/verify
 * Verify RFID card + xác định amountDue + canOpenGate
 */
export async function verifyExit(request: Request, response: Response) {
  const { sessionId, uid } = request.body as {
    sessionId?: string;
    uid?: string;
  };

  if (!sessionId || !uid) {
    response
      .status(400)
      .json({ verified: false, reason: "Thiếu sessionId hoặc uid" });
    return;
  }

  const session = await ParkingSession.findById(sessionId);
  if (!session) {
    response
      .status(404)
      .json({ verified: false, reason: "Không tìm thấy phiên gửi xe" });
    return;
  }

  // Kiểm tra session đang chờ xác minh RFID
  if (session.exitState !== "waiting_rfid") {
    response.status(400).json({
      verified: false,
      reason: `Session không ở trạng thái chờ xác minh (exitState=${session.exitState})`,
    });
    return;
  }

  // Kiểm tra session chưa bị checkout bởi luồng khác
  if (session.status !== "Đang gửi") {
    response.status(400).json({
      verified: false,
      reason: "Session đã được xử lý bởi luồng khác",
    });
    return;
  }

  const card = await RfidCard.findOne({ uid: uid.trim() });

  if (card && card.status !== "active") {
    response
      .status(400)
      .json({ verified: false, reason: "Thẻ RFID không active" });
    return;
  }

  if (card) {
    // Thẻ còn tồn tại: kiểm tra plate
    const cardPlate = card.plate?.toUpperCase().trim() ?? "";
    if (cardPlate !== "" && cardPlate !== session.plate.toUpperCase().trim()) {
      response.status(400).json({
        verified: false,
        reason: "Thẻ RFID không khớp với biển số của phiên này",
      });
      return;
    }
    if (cardPlate === "") {
      // Thẻ Guest còn tồn tại: tra CameraLog lúc vào
      const entryLog = await ParkingCameraLog.findOne({
        sessionId: session._id,
        direction: "in",
        rfidUid: uid.trim(),
      });
      if (!entryLog) {
        response.status(400).json({
          verified: false,
          reason: "Thẻ Guest không khớp với thẻ đã dùng lúc vào",
        });
        return;
      }
    }
  } else {
    // Thẻ không tìm thấy (có thể AI service đã xóa sau khi xe ra)
    // Fallback: kiểm tra CameraLog direction=in của phiên này có rfidUid khớp không
    const entryLog = await ParkingCameraLog.findOne({
      sessionId: session._id,
      direction: "in",
      rfidUid: uid.trim(),
    });
    if (!entryLog) {
      response.status(400).json({
        verified: false,
        reason: "Không tìm thấy thẻ RFID và UID không khớp lịch sử vào",
      });
      return;
    }
  }

  // RFID verify OK
  session.exitState = "rfid_verified";
  session.exitRfidUid = uid.trim();
  session.exitRfidVerifiedAt = new Date();
  await session.save();

  // Tính amountDue dựa trên subscription status
  const ownerUserId =
    session.ownerUserId || (await session.populate("ownerUserId")).ownerUserId;
  const activeSubscription = await findActiveSubscriptionByPlate(
    session.plate,
    ownerUserId,
  );

  let amountDue = 0;
  let isSubscriber = false;
  let paymentStatus = session.paymentStatus || "pending";

  if (activeSubscription) {
    isSubscriber = true;
    amountDue = 0;
    paymentStatus = "fully_paid";
  } else {
    isSubscriber = false;
    // Tính phí nếu chưa có fee (trường hợp session được tạo mà chưa tính phí)
    if (session.fee == null || session.fee === 0) {
      const checkInAt = new Date(session.checkInAt);
      const now = new Date();
      const pricing = await getActivePricingConfig();
      const feeBreakdown = calculateParkingFee(checkInAt, now, pricing);
      session.fee = feeBreakdown.totalFee;
      session.feeBreakdown = feeBreakdown;
      await session.save();
    }
    amountDue = (session.fee || 0) - (session.paidAmount || 0);
    if (amountDue <= 0) {
      paymentStatus = "fully_paid";
      amountDue = 0;
    }
  }

  // canOpenGate = RFID verified AND amountDue <= 0 AND paymentStatus = fully_paid
  const canOpenGate =
    session.exitRfidVerifiedAt != null &&
    amountDue <= 0 &&
    paymentStatus === "fully_paid";

  response.json({
    verified: true,
    sessionId: session._id.toString(),
    amountDue,
    paymentStatus,
    isSubscriber,
    canOpenGate,
  });
}

/**
 * Backend POST /api/exit/open-gate
 * Gateway authorize + mở barie (bridge call FIRST, finalize only on OK)
 */
export async function openGate(request: Request, response: Response) {
  const { sessionId } = request.body as { sessionId?: string };

  if (!sessionId) {
    response.status(400).json({ ok: false, message: "Thiếu sessionId" });
    return;
  }

  const session = await ParkingSession.findById(sessionId);
  if (!session) {
    response
      .status(404)
      .json({ ok: false, message: "Không tìm thấy phiên gửi xe" });
    return;
  }

  // Kiểm tra điều kiện mở gate
  if (!session.exitRfidVerifiedAt) {
    response
      .status(403)
      .json({ ok: false, message: "RFID chưa được xác minh" });
    return;
  }

  const ownerUserId =
    session.ownerUserId || (await session.populate("ownerUserId")).ownerUserId;
  const activeSubscription = await findActiveSubscriptionByPlate(
    session.plate,
    ownerUserId,
  );

  let amountDue = 0;
  if (activeSubscription) {
    amountDue = 0;
  } else {
    if (session.fee == null || session.fee === 0) {
      const checkInAt = new Date(session.checkInAt);
      const now = new Date();
      const pricing = await getActivePricingConfig();
      const feeBreakdown = calculateParkingFee(checkInAt, now, pricing);
      session.fee = feeBreakdown.totalFee;
      session.feeBreakdown = feeBreakdown;
      await session.save();
    }
    amountDue = (session.fee || 0) - (session.paidAmount || 0);
  }

  if (amountDue > 0) {
    response.status(403).json({
      ok: false,
      message: `Chưa đủ điều kiện mở barie. amountDue = ${amountDue}`,
    });
    return;
  }

  // Đánh dấu đang xử lý mở gate
  session.exitState = "gate_authorizing";
  await session.save();

  try {
    // Gọi bridge mở barie (server-to-server)
    const bridgeUrl = env.bridgeServiceUrl.replace(/\/+$/, "");

    const bridgeResponse = await fetch(`${bridgeUrl}/gate/out/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session._id.toString() }),
    });

    if (!bridgeResponse.ok) {
      const errorText = await bridgeResponse.text();
      console.warn(
        `[openGate] Bridge trả lỗi ${bridgeResponse.status}: ${errorText}`,
      );

      // Rollback state
      session.exitState = "rfid_verified";
      await session.save();

      response
        .status(502)
        .json({ ok: false, message: "Không mở được barie, vui lòng thử lại" });
      return;
    }

    const bridgeResult = await bridgeResponse.json();
    console.log(`[openGate] Bridge OK:`, bridgeResult);

    // Bridge OK — mới finalize session
    session.status = "Đã hoàn thành";
    session.checkOutAt = new Date();
    session.exitState = "gate_opened";
    await session.save();

    // Free slot
    if (session.slotId) {
      const { freeSlot } = await import("../services/parkingSlot.service.js");
      await freeSlot(session.slotId);
    }

    response.json({ ok: true, message: "Đã mở barie cổng ra" });
  } catch (err) {
    console.error("[openGate] Bridge call failed:", err);

    // Rollback state
    session.exitState = "rfid_verified";
    await session.save();

    response
      .status(500)
      .json({ ok: false, message: "Lỗi kết nối bridge, vui lòng thử lại" });
  }
}

/**
 * GET /api/exit/pending
 * Trả về phiên xe ra gần nhất đang chờ RFID (exitState = "waiting_rfid")
 * để frontend restore state khi mount hoặc SSE kết nối lại.
 */
export async function getPendingExit(request: Request, response: Response) {
  // Tìm phiên đang chờ xác minh RFID, mới nhất
  const session = await ParkingSession.findOne({
    exitState: "waiting_rfid",
    status: "Đang gửi",
  })
    .sort({ exitDetectedAt: -1 })
    .lean();

  if (!session) {
    response.json({ pending: false });
    return;
  }

  // Tìm camera log gần nhất tương ứng với session này
  const cameraLog = await ParkingCameraLog.findOne({
    sessionId: session._id,
    direction: "out",
  })
    .sort({ createdAt: -1 })
    .lean();

  response.json({
    pending: true,
    event: {
      id: cameraLog?._id.toString() ?? session._id.toString(),
      direction: "out" as const,
      plate: session.plate,
      detectedPlate: session.exitDetectedPlate ?? session.plate,
      confidence: session.exitConfidence ?? null,
      sessionId: session._id.toString(),
      checkInAt: session.checkInAt.toISOString(),
      sessionStatus: "Đang gửi",
      exitState: "waiting_rfid",
      action: "waiting_rfid",
      sessionPaymentStatus: session.paymentStatus ?? "pending",
      fee: session.fee ?? null,
      userType: "unknown" as const,
      barrierOpened: false,
      createdAt: (session.exitDetectedAt ?? session.checkInAt).toISOString(),
    },
  });
}

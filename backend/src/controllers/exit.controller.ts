import { Request, Response } from "express";
import mongoose from "mongoose";
import { ParkingSession } from "../models/ParkingSession.js";
import { RfidCard } from "../models/RfidCard.js";
import { ParkingCameraLog } from "../models/ParkingCameraLog.js";
import { findActiveSubscriptionByPlate } from "../services/subscription.service.js";
import { calculateParkingFee } from "../services/pricing.service.js";
import { getActivePricingConfig } from "../services/pricing.service.js";
import { env } from "../config/env.js";
import {
  classifyExitMismatch,
  settleExitAfterVerify,
} from "../services/exitMismatch.service.js";

function actorId(request: Request) {
  const id = request.user?.id;
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return undefined;
}

/** POST /api/exit/verify — Verify RFID + amountDue + canOpenGate */
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

  const scannedUid = uid.trim();
  const card = await RfidCard.findOne({ uid: scannedUid });

  if (card && !["active", "in-use"].includes(card.status)) {
    response.status(400).json({
      verified: false,
      exception: false,
      reason:
        card.status === "lost"
          ? "Thẻ đã bị báo mất"
          : card.status === "blocked"
            ? card.blockedReason || "Thẻ đã bị khóa"
            : "Thẻ RFID không hợp lệ để ra",
    });
    return;
  }

  const mismatch = await classifyExitMismatch({ session, uid: scannedUid });
  if (mismatch) {
    response.status(409).json(mismatch);
    return;
  }

  session.exitRfidUid = scannedUid;
  const settled = await settleExitAfterVerify(session);
  response.json(settled);
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
  const isMemberSession = session.customerType === "member";
  const activeSubscription = isMemberSession ? null : await findActiveSubscriptionByPlate(session.plate);

  let amountDue = 0;
  if (isMemberSession || activeSubscription) {
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

    // Guest trả thẻ vào kho; Member tiếp tục sở hữu và dùng lại thẻ ở lần tiếp theo.
    const usedCard = session.exitRfidUid
      ? await RfidCard.findOne({ uid: session.exitRfidUid })
      : null;
    if (usedCard) {
      usedCard.lastUsedAt = new Date();
      if (usedCard.cardType === "guest") {
        // RFID Guest được tái sử dụng. Không để lại biển/chủ xe từ phiên cũ,
        // vì dữ liệu đó không phải liên kết cố định và có thể gây false
        // `wrong_card` ở lần xe tiếp theo ra cổng.
        const returnedAt = new Date();
        usedCard.status = "available";
        usedCard.returnedAt = returnedAt;
        usedCard.plate = "";
        usedCard.ownerName = "Guest";
        usedCard.userId = undefined;
        usedCard.vehicleId = undefined;
        session.rfidReturnedAt = returnedAt;
        await session.save();
      } else {
        usedCard.status = "active";
      }
      await usedCard.save();
    }

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

/**
 * POST /api/exit/resolve-mismatch
 * Nhân viên xác nhận / hiệu chỉnh / từ chối lệch định danh tại cổng ra.
 */
export async function resolveExitMismatch(request: Request, response: Response) {
  const body = request.body as {
    sessionId?: string;
    action?: string;
    manualPlate?: string;
    verificationNote?: string;
  };
  const sessionId = String(body.sessionId || "").trim();
  const action = String(body.action || "").trim();
  const note = String(body.verificationNote || "").trim();
  const manualPlate = String(body.manualPlate || "").trim().toUpperCase();

  if (!sessionId || !action) {
    response.status(400).json({ ok: false, message: "Thiếu sessionId hoặc action" });
    return;
  }

  const session = await ParkingSession.findById(sessionId);
  if (!session) {
    response.status(404).json({ ok: false, message: "Không tìm thấy phiên gửi xe" });
    return;
  }
  if (session.status !== "Đang gửi") {
    response.status(400).json({ ok: false, message: "Phiên không còn đang gửi" });
    return;
  }

  const exceptionType = session.exceptionType || "";
  const scannedUid = session.exitRfidUid || "";
  const needsNote = ["confirm", "correct_exit_plate", "correct_session_plate", "accept_uid"].includes(action);
  if (needsNote && note.length < 8) {
    response.status(400).json({ ok: false, message: "Vui lòng nhập lý do xử lý (tối thiểu 8 ký tự)." });
    return;
  }

  if (exceptionType === "wrong_card" || exceptionType === "two_vehicles") {
    if (action !== "retry" && action !== "reject") {
      response.status(400).json({
        ok: false,
        message: "Thẻ đang gắn xe khác. Chỉ được quẹt lại hoặc từ chối.",
      });
      return;
    }
  }

  if (action === "retry") {
    session.verificationStatus = "Chờ duyệt";
    session.exitState = "waiting_rfid";
    await session.save();
    response.json({ ok: true, retry: true, message: "Quẹt lại thẻ RFID." });
    return;
  }

  if (action === "reject") {
    session.verificationStatus = "Từ chối";
    session.verificationNote = note || "Từ chối cho xe ra do sai lệch định danh";
    session.verifiedBy = actorId(request);
    session.verifiedAt = new Date();
    session.exitState = "waiting_rfid";
    await session.save();
    response.json({ ok: true, rejected: true, message: "Đã từ chối. Barrier giữ đóng." });
    return;
  }

  if (action === "correct_exit_plate") {
    if (manualPlate.length < 5) {
      response.status(400).json({ ok: false, message: "Nhập biển số ra đã hiệu chỉnh." });
      return;
    }
    session.exitDetectedPlate = manualPlate;
    session.manualPlate = manualPlate;
  }

  if (action === "correct_session_plate") {
    if (manualPlate.length < 5) {
      response.status(400).json({ ok: false, message: "Nhập biển phiên đã hiệu chỉnh." });
      return;
    }
    const other = await ParkingSession.findOne({
      _id: { $ne: session._id },
      status: "Đang gửi",
      plate: manualPlate,
    });
    if (other) {
      response.status(409).json({
        ok: false,
        message: `Xe ${manualPlate} vẫn đang gửi. Không được đổi biển phiên.`,
      });
      return;
    }
    session.plate = manualPlate;
    session.manualPlate = manualPlate;
  }

  if (action === "accept_uid" || action === "confirm" || action === "correct_exit_plate" || action === "correct_session_plate") {
    session.verificationNote = note;
    session.verifiedBy = actorId(request);
    session.verifiedAt = new Date();
    if (scannedUid) session.exitRfidUid = scannedUid;
    const settled = await settleExitAfterVerify(session);
    response.json({ ok: true, ...settled });
    return;
  }

  response.status(400).json({ ok: false, message: `Action không hợp lệ: ${action}` });
}

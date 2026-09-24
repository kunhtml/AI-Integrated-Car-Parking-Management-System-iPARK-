import mongoose from "mongoose";
import { Request, Response } from "express";
import { createGateCommandLog } from "../services/gateCommandLog.service.js";
import { z } from "zod";
import { ParkingCameraLog } from "../models/ParkingCameraLog.js";
import {
  ParkingSession,
  ParkingSessionDocument,
} from "../models/ParkingSession.js";
import { RfidCard } from "../models/RfidCard.js";
import { Vehicle } from "../models/Vehicle.js";
import { cameraEventBus } from "../services/camera-event-bus.js";
import { freeSlot } from "../services/parkingSlot.service.js";
import {
  findActiveSubscriptionByPlate,
  findLatestSubscriptionEndByPlate,
  findSubscriptionStateByPlate,
} from "../services/subscription.service.js";
import { createPendingTransactionForSession } from "../services/transaction.service.js";
import {
  calculateParkingFee,
  getActivePricingConfig,
} from "../services/pricing.service.js";
import { createParkingSession } from "./parkingSessions.controller.js";
import { createAuditLog } from "../services/auditLog.service.js";

function normalizePlate(plate: string): string {
  return (plate || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

/**
 * Tính phí theo giờ đơn giản (dùng cho checkout từ bridge).
 * Trả về fee = max(0, (số phút - free) / 60 * rate) làm tròn lên.
 */
export function calcSimpleFee(
  checkInAt: Date,
  checkOutAt: Date,
  hourlyRate = 5000,
  freeMinutes = 15,
): number {
  const minutes = Math.max(
    0,
    Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000),
  );
  const billable = Math.max(0, minutes - freeMinutes);
  const hours = Math.ceil(billable / 60);
  return Math.max(0, hours * hourlyRate);
}

/**
 * Xử lý checkout cho phiên đang đỗ.
 * Bridge không có AI service đầy đủ nên dùng giá đơn giản (giờ * 5000).
 */
async function finalizeBridgeCheckout(
  session: mongoose.HydratedDocument<ParkingSessionDocument>,
) {
  session.status = "Đã hoàn thành";
  session.checkOutAt = new Date();

  if (session.paymentStatus !== "fully_paid") {
    const pricing = await getActivePricingConfig();
    const feeBreakdown = calculateParkingFee(
      session.checkInAt,
      session.checkOutAt,
      pricing,
    );
    session.fee = feeBreakdown.totalFee;
    session.feeBreakdown = feeBreakdown;
    await createPendingTransactionForSession(session);
  }

  if (session.rfidCardId) {
    const usedCard = await RfidCard.findOne({
      $or: [{ uid: session.rfidCardId }, { cardId: session.rfidCardId }],
    });
    if (usedCard) {
      const returnedAt = new Date();
      usedCard.lastUsedAt = returnedAt;
      if (usedCard.cardType === "member") {
        usedCard.status = "active";
      } else {
        usedCard.status = "available";
        usedCard.returnedAt = returnedAt;
        usedCard.plate = "";
        usedCard.ownerName = "Guest";
        usedCard.userId = undefined;
        usedCard.vehicleId = undefined;
        session.rfidReturnedAt = returnedAt;
      }
      await usedCard.save();
    }
  }

  await session.save();
  await freeSlot(session.slotId);
  return session;
}

/**
 * POST /api/bridge/log
 * Python service đẩy log xe vào/ra lên đây.
 *
 * Body:
 * {
 *   direction: "in" | "out",
 *   detectedPlate: string,
 *   confidence?: number,
 *   rfidUid?: string,
 *   ownerName?: string,
 *   plate?: string,           // biển số đã biết (ưu tiên hơn detectedPlate)
 *   userType?: "resident" | "guest" | "unknown",
 *   imagePath?: string,
 *   plateCropPath?: string,   // crop riêng quanh biển (staff đối chiếu tay)
 *   barrierOpened?: boolean,
 *   metadata?: object
 * }
 */
export async function pushCameraLog(request: Request, response: Response) {
  const body = z
    .object({
      direction: z.enum(["in", "out"]),
      detectedPlate: z.string().trim().default(""),
      confidence: z.number().min(0).max(1).optional(),
      rfidUid: z.string().trim().optional(),
      ownerName: z.string().trim().optional(),
      plate: z.string().trim().optional(),
      userType: z.enum(["resident", "guest", "unknown"]).default("unknown"),
      imagePath: z.string().trim().optional(),
      plateCropPath: z.string().trim().optional(),
      barrierOpened: z.boolean().default(false),
      metadata: z.record(z.string(), z.any()).optional(),
    })
    .parse(request.body);

  const plate = normalizePlate(body.plate || body.detectedPlate);
  const detectedPlate = normalizePlate(body.detectedPlate);
  // direction do AI bridge gửi lên chính là kênh vật lý đã OCR xong.
  // Không remap qua Device và không mặc định "out" thành "in": nếu không,
  // ảnh/biển số camera ra sẽ bị lưu nhầm vào entryImageUrl/entryDetectedPlate.
  const direction: "in" | "out" = body.direction;

  // Tìm RfidCard nếu có
  let rfidCard = null as null | { _id: any; uid: string };
  if (body.rfidUid) {
    rfidCard = await RfidCard.findOne({ uid: body.rfidUid.trim() });
  }

  // Tìm vehicle
  const vehicle = await Vehicle.findOne({ plate });

  let sessionId: any = undefined;
  let action:
    | "skipped"
    | "no_session"
    | "duplicate"
    | "pending_review" = "skipped";
  let openSession: typeof ParkingSession.prototype | null = null;
  let entryReviewState: "pending_review" | undefined;

  if (direction === "in" && plate) {
    // Cổng vào: camera/RFID CHỈ phát hiện — không tạo phiên, không mở barie.
    // Nhân viên phải đối chiếu biển số trên /staff-desk rồi bấm
    // "Xác nhận thông tin & Mở barie" (POST /camera-logs/entry-reviews/:id/confirm).
    entryReviewState = "pending_review";
    action = "pending_review";
    const norm = plate.replace(/[\s\.-]+/g, "");
    const regexPattern = norm
      .split("")
      .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s\\.-]*");
    const plateRegex = new RegExp(`^${regexPattern}$`, "i");
    const dup = await ParkingSession.findOne({
      status: "Đang gửi",
      $or: [
        { plate },
        { plate: norm },
        { plate: plateRegex },
        { entryDetectedPlate: plate },
        { entryDetectedPlate: norm },
        { entryDetectedPlate: plateRegex },
        { manualPlate: plate },
        { manualPlate: norm },
        { manualPlate: plateRegex },
      ],
    });
    if (dup) {
      // Chỉ cảnh báo trùng trên UI — vẫn KHÔNG tự tạo/gắn sessionId vào log.
      action = "duplicate";
      openSession = dup;
    }
    console.log(
      `[pushCameraLog] direction=in plate=${plate} rfidUid=${body.rfidUid ?? "none"} action=${action} sessionId=${sessionId ?? "none"}`,
    );
  } else if (direction !== "in") {
    // OUT: tìm phiên đang mở gần nhất theo biển số
    openSession = await ParkingSession.findOne({
      $or: [
        ...(sessionId && mongoose.Types.ObjectId.isValid(sessionId)
          ? [{ _id: new mongoose.Types.ObjectId(sessionId) }]
          : []),
        { plate },
        { entryDetectedPlate: plate },
        { manualPlate: plate },
      ],
      status: "Đang gửi",
    }).sort({ checkInAt: -1 });
    console.log(
      `[pushCameraLog] direction=out plate=${plate} openSession=${openSession?._id ?? "NOT FOUND"}`,
    );
    if (openSession) {
      // Gán ảnh ra từ camera vào phiên.
      if (body.imagePath) {
        openSession.exitImageUrl = body.imagePath;
      }
      if (detectedPlate) {
        openSession.exitDetectedPlate = detectedPlate;
      }
      if (typeof body.confidence === "number") {
        openSession.exitConfidence = body.confidence;
      }
      const activeMembership = await findActiveSubscriptionByPlate(plate);
      const expectedMemberCard = activeMembership
        ? await RfidCard.findOne({
            plate,
            cardType: "member",
            status: { $in: ["active", "in-use"] },
          })
            .sort({ updatedAt: -1 })
            .select("uid")
        : null;
      openSession.expectedExitRfidUid = expectedMemberCard?.uid;
      // Đánh dấu đang chờ xác minh RFID — KHÔNG finalize, KHÔNG freeSlot.
      // Không hạ thấp trạng thái đã tiến xa hơn (mismatch/verify/thanh
      // toán/gate): push trùng theo chu kỳ phải giữ nguyên state của staff.
      if (!openSession.exitState || openSession.exitState === "waiting_rfid") {
        openSession.exitState = "waiting_rfid";
        openSession.exitDetectedAt = new Date();
      }
      // Tính phí dự kiến (hiển thị trên UI)
      if (!activeMembership && openSession.paymentMethod === "subscription") {
        // Gói đã hết hạn sau lúc xe vào: bỏ trạng thái miễn phí đã gán lúc check-in.
        openSession.paymentStatus = "unpaid";
        openSession.paymentMethod = undefined;
      }
      if (openSession.paymentStatus !== "fully_paid") {
        const pricing = await getActivePricingConfig();
        const checkOutAt = new Date();
        const subscriptionEnd = await findLatestSubscriptionEndByPlate(plate);
        const billableFrom =
          subscriptionEnd &&
          subscriptionEnd > openSession.checkInAt &&
          subscriptionEnd < checkOutAt
            ? subscriptionEnd
            : openSession.checkInAt;
        const feeBreakdown = calculateParkingFee(
          billableFrom,
          checkOutAt,
          pricing,
        );
        openSession.fee = feeBreakdown.totalFee;
        openSession.feeBreakdown = feeBreakdown;
      }
      if (!openSession.vehicleType) {
        openSession.vehicleType = "Ô tô";
      }
      await openSession.save();
      sessionId = openSession._id;
      action = "skipped"; // skipped = camera detect, chưa finalize
    } else {
      action = "no_session";
    }
  }

  const log = await ParkingCameraLog.create({
    direction,
    detectedPlate,
    confidence: body.confidence,
    rfidUid: body.rfidUid,
    ownerName: body.ownerName || (rfidCard?.uid ? "" : ""),
    plate,
    userType: body.userType,
    imagePath: body.imagePath,
    plateCropPath: body.plateCropPath,
    barrierOpened: body.barrierOpened,
    sessionId,
    vehicleId: vehicle?._id,
    rfidCardId: rfidCard?._id,
    metadata: body.metadata,
    ...(entryReviewState ? { entryReviewState } : {}),
  });

  // Realtime push tới /staff-desk qua SSE bus cho cả cổng vào và cổng ra.
  const activeMemberSubscription = plate
    ? await findActiveSubscriptionByPlate(plate)
    : null;
  // Gói đăng ký đã hết hạn/hủy — bảng xe ra phải báo "Gói đăng ký hết hạn"
  // thay vì "Khách có gói đăng ký" để staff thu phí phiên.
  const lapsedSubscription =
    !activeMemberSubscription && plate
      ? await findSubscriptionStateByPlate(plate)
      : null;
  // Thẻ Member khách đã mua đứt cho biển số — tra cả khi gói dịch vụ đã hết
  // hạn: bàn nhân viên cần hiện UID thẻ khách đang giữ để đối chiếu thẻ vật lý.
  const memberCardForPlate = activeMemberSubscription
    ? await RfidCard.findOne({
        plate,
        cardType: "member",
        status: { $in: ["active", "in-use"] },
      })
      .sort({ soldAt: -1, updatedAt: -1 })
      .select("uid")
      .lean()
    : null;
  const purchasedCardForPlate =
    !memberCardForPlate && plate
      ? await RfidCard.findOne({
          plate,
          cardType: "member",
          status: { $in: ["active", "in-use"] },
        })
        .sort({ soldAt: -1, updatedAt: -1 })
        .select("uid")
        .lean()
      : null;
  const eventUserType =
    openSession?.customerType === "member" || activeMemberSubscription
      ? "resident"
      : body.userType;
  const eventOwnerName =
    openSession?.ownerName ||
    body.ownerName ||
    vehicle?.ownerName ||
    "Chưa xác định";
  const expectedRfidUid =
    openSession?.expectedExitRfidUid || memberCardForPlate?.uid || null;
  // UID thẻ Member khách đã mua đứt (kể cả khi gói đăng ký đã hết hạn) —
  // frontend dùng để hiện thẻ khách đang giữ trên bàn nhân viên.
  const purchasedCardUid =
    memberCardForPlate?.uid || purchasedCardForPlate?.uid || null;
  const entryCardId = String(openSession?.rfidCardId || "");
  const entryCard = entryCardId
    ? await RfidCard.findOne({
        $or: [
          ...(mongoose.Types.ObjectId.isValid(entryCardId)
            ? [{ _id: new mongoose.Types.ObjectId(entryCardId) }]
            : []),
          { uid: entryCardId },
          { cardId: entryCardId },
        ],
      })
        .select("uid")
        .lean()
    : null;
  const entryLog = openSession?._id
    ? await ParkingCameraLog.findOne({
        sessionId: openSession._id,
        direction: "in",
        rfidUid: { $exists: true, $nin: [null, ""] },
      })
        .sort({ createdAt: -1 })
        .select("rfidUid")
        .lean()
    : null;
  const entryRfidUid =
    openSession?.entryRfidUid ||
    openSession?.entryExpectedRfidUid ||
    entryCard?.uid ||
    entryLog?.rfidUid ||
    null;
  const eventMetadata = {
    ...(body.metadata ?? {}),
    vehicleBrand: vehicle?.brand || null,
    vehicleModel: vehicle?.model || null,
    vehicleType: (vehicle as any)?.type || vehicle?.vehicleType || null,
    purchasedCardUid,
    ...(activeMemberSubscription
      ? {
          isSubscriber: true,
          expectedRfidUid,
          subscriptionPlan: activeMemberSubscription.planName,
          subscriptionEndDate: activeMemberSubscription.endDate,
        }
      : {}),
    ...(lapsedSubscription && !lapsedSubscription.isActive
      ? {
          subscriptionStatus: lapsedSubscription.status,
          subscriptionEndDate: lapsedSubscription.endDate,
        }
      : {}),
    entryRfidUnverified: Boolean(openSession?.entryRfidUnverified),
    entryRfidExpected: Boolean(
      !openSession?.entryRfidUid && openSession?.entryExpectedRfidUid,
    ),
    entryRfidUid,
    entrySource: openSession?.entrySource || "camera",
    manualEntryReason: openSession?.manualEntryReason || null,
    entryPhotoStatus: openSession?.entryPhotoStatus || null,
    // Thẻ thay thế (đổi thẻ mới khi thẻ cũ hỏng/mất) — hiển thị để nhân viên
    // biết xe dùng thẻ mới thay cho thẻ đã quét lúc vào.
    replacementCardUid:
      openSession?.expectedExitRfidUid &&
      openSession.expectedExitRfidUid !== openSession.entryRfidUid
        ? openSession.expectedExitRfidUid
        : null,
  };
  const isExitWaiting =
    direction === "out" && action === "skipped" && sessionId;
  cameraEventBus.emitIngest({
    id: log._id.toString(),
    direction,
    plate,
    detectedPlate,
    confidence: body.confidence,
    rfidUid: body.rfidUid,
    ownerName: eventOwnerName,
    userType: eventUserType,
    imagePath: body.imagePath,
    plateCropPath: body.plateCropPath,
    entryImagePath: openSession?.entryImageUrl,
    barrierOpened: body.barrierOpened,
    sessionId: sessionId?.toString() ?? null,
    checkInAt: openSession?.checkInAt?.toISOString() ?? null,
    sessionStatus:
      isExitWaiting
          ? "Đang gửi"
          : null,
    exitState: isExitWaiting ? openSession?.exitState || "waiting_rfid" : null,
    action: isExitWaiting ? "waiting_rfid" : action,
    sessionPaymentStatus: isExitWaiting ? "pending" : null,
    duplicateSession: action === "duplicate",
    entryReviewState: entryReviewState ?? null,
    metadata: {
      ...eventMetadata,
      customerType:
        openSession?.customerType ??
        (activeMemberSubscription ? "member" : "guest"),
      quotaType: openSession?.quotaType ?? null,
    },

    fee: isExitWaiting ? ((openSession as any)?.fee ?? null) : null,
    createdAt: log.createdAt.toISOString(),
  });

  // Phân biệt:
  // - Cổng vào KHÔNG BAO GIỜ tự tạo phiên: `pending_review` → 200, log chờ
  //   nhân viên đối chiếu biển số rồi xác nhận qua entry-reviews/:id/confirm.
  // - `duplicate` ở cổng vào chỉ là cảnh báo cho staff (vẫn 200 — quyền
  //   quyết định thuộc về nhân viên, không phải máy).
  const status = 200;
  const ok = true;
  response.status(status).json({
    ok,
    log: {
      id: log._id.toString(),
      direction: log.direction,
      plate: log.plate,
      detectedPlate: log.detectedPlate,
      action,
      sessionId: sessionId?.toString(),
    },
    message:
      action === "duplicate"
        ? `Xe ${plate} đang có phiên gửi trong bãi — nhân viên đối chiếu trước khi mở barie.`
        : action === "no_session"
          ? `Không tìm thấy phiên đang gửi cho biển ${plate}`
          : `AI đã nhận biển ${plate} — chờ nhân viên xác nhận.`,
  });
}

/**
 * GET /api/bridge/logs?limit=20
 * Trả về log gần nhất cho dashboard.
 */
export async function listCameraLogs(request: Request, response: Response) {
  const limit = Math.min(Number(request.query.limit || 20), 200);
  const logs = await ParkingCameraLog.find()
    .sort({ createdAt: -1 })
    .limit(limit);

  const sessionIds = logs
    .map((l) => l.sessionId)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const sessions =
    sessionIds.length > 0
      ? await ParkingSession.find({ _id: { $in: sessionIds } })
          .select("paymentStatus fee paidAmount status")
          .lean()
      : [];
  const sessionMap = new Map(sessions.map((s) => [s._id.toString(), s]));

  response.json({
    logs: logs.map((l) => {
      const sid = l.sessionId?.toString();
      const sess = sid ? sessionMap.get(sid) : undefined;
      return {
        id: l._id.toString(),
        direction: l.direction,
        detectedPlate: l.detectedPlate,
        plate: l.plate,
        ownerName: l.ownerName,
        rfidUid: l.rfidUid,
        userType: l.userType,
        barrierOpened: l.barrierOpened,
        imagePath: l.imagePath,
        plateCropPath: l.plateCropPath,
        sessionId: sid ?? null,
        sessionStatus: sess?.status ?? null,
        sessionPaymentStatus: sess?.paymentStatus ?? null,
        sessionFee: sess?.fee ?? null,
        sessionPaidAmount: sess?.paidAmount ?? null,
        createdAt: l.createdAt,
      };
    }),
  });
}

/**
 * DELETE /api/bridge/logs
 * Xóa toàn bộ nhật ký camera (chỉ admin).
 */
export async function clearCameraLogs(request: Request, response: Response) {
  const result = await ParkingCameraLog.deleteMany({});
  response.json({
    ok: true,
    deleted: result.deletedCount ?? 0,
    message: `Đã xóa ${result.deletedCount ?? 0} bản ghi nhật ký camera.`,
  });
}

/**
 * POST /api/bridge/gate/:direction/:action
 * Bridge ghi nhận barrier open/close. Không tạo ParkingCameraLog
 * vì log này dành cho camera detect biển số — manual gate không có detectedPlate.
 */
export async function bridgeGateControl(request: Request, response: Response) {
  const direction = String(request.params.direction || "");
  const action = String(request.params.action || "");
  if (
    !["in", "out"].includes(direction) ||
    !["open", "close"].includes(action)
  ) {
    response
      .status(400)
      .json({ ok: false, message: "Invalid direction or action" });
    return;
  }
  const source = String(
    request.header("x-gate-command-source") || "AI bridge",
  ).slice(0, 100);
  await createGateCommandLog({
    gate: direction as "in" | "out",
    command: action as "open" | "close",
    source,
    success: true,
    message: `Lệnh ${action === "open" ? "mở" : "đóng"} barrier từ ${source}.`,
  });

  // eslint-disable-next-line no-console
  console.log(
    `[bridge.gate] direction=${direction} action=${action} source=${source} ts=${new Date().toISOString()}`,
  );
  response.json({ ok: true, message: `Gate ${direction} ${action} recorded` });
}

/**
 * GET /api/bridge/health
 * Kiểm tra Python service có gọi được backend không.
 */
export async function bridgeHealth(_request: Request, response: Response) {
  response.json({
    ok: true,
    service: "ipark-bridge",
    backend: "ipark-backend",
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/bridge/roi
 * Python ai-service lấy ROI từng cổng để crop frame trước khi detect.
 */
export async function bridgeRoi(_request: Request, response: Response) {
  const { Device } = await import("../models/Device.js");
  const devices = await Device.find({ gate: { $in: ["entry", "exit"] } })
    .select("gate roi")
    .lean();
  const rois: Record<string, unknown> = {};
  for (const device of devices) {
    if (device.roi) {
      rois[device.gate] = device.roi;
    }
  }
  response.json({ ok: true, rois });
}

/* ------------------------------------------------------------------ */
/* Entry review — nhân viên đối chiếu biển số camera trước khi mở barie */
/* ------------------------------------------------------------------ */

function serializeEntryReview(log: {
  _id: mongoose.Types.ObjectId;
  detectedPlate?: string | null;
  plate?: string | null;
  confidence?: number | null;
  rfidUid?: string | null;
  ownerName?: string | null;
  userType?: string | null;
  imagePath?: string | null;
  plateCropPath?: string | null;
  entryReviewState?: string | null;
  confirmedPlate?: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown> | null;
}) {
  return {
    id: log._id.toString(),
    direction: "in" as const,
    detectedPlate: log.detectedPlate || "",
    plate: log.plate || log.detectedPlate || "",
    confidence: log.confidence,
    rfidUid: log.rfidUid,
    ownerName: log.ownerName,
    userType: log.userType || "unknown",
    imagePath: log.imagePath,
    plateCropPath: log.plateCropPath,
    entryReviewState: log.entryReviewState || "pending_review",
    confirmedPlate: log.confirmedPlate,
    createdAt: log.createdAt.toISOString(),
    metadata: log.metadata ?? {},
  };
}

/**
 * GET /api/camera-logs/entry-reviews/pending
 * Danh sách sự kiện camera cổng vào còn chờ nhân viên xác nhận
 * (dùng để khôi phục hàng đợi khi /staff-desk tải lại hoặc SSE reconnect).
 */
export async function listPendingEntryReviews(
  _request: Request,
  response: Response,
) {
  const logs = await ParkingCameraLog.find({
    direction: "in",
    entryReviewState: "pending_review",
    sessionId: null,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  // Một biển có thể được camera đẩy nhiều lần — giữ sự kiện mới nhất.
  const seen = new Set<string>();
  const reviews: ReturnType<typeof serializeEntryReview>[] = [];
  for (const log of logs) {
    const key = normalizePlate(log.plate || log.detectedPlate || "") || String(log._id);
    if (seen.has(key)) continue;
    seen.add(key);
    reviews.push(serializeEntryReview(log));
  }
  response.json({ ok: true, reviews });
}

/**
 * POST /api/camera-logs/entry-reviews/:id/confirm
 * Body: { plate, confirmationNote?, rfidUid? }
 *
 * Nhân viên đã đối chiếu biển số (có thể sửa nếu AI nhận sai) → tạo phiên
 * qua cùng luồng kiểm tra với POST /parking-sessions, gắn phiên vào log gốc
 * và chuyển log sang "confirmed". Barie do frontend mở sau khi confirm OK.
 * Idempotent: log đã confirm/dismissed → 409.
 */
export async function confirmEntryReview(
  request: Request,
  response: Response,
) {
  const logId = String(request.params.id || "");
  if (!mongoose.Types.ObjectId.isValid(logId)) {
    response.status(400).json({ ok: false, message: "ID sự kiện không hợp lệ." });
    return;
  }
  const body = z
    .object({
      plate: z.string().trim().min(5, "Biển số phải có ít nhất 5 ký tự."),
      confirmationNote: z.string().trim().optional(),
      rfidUid: z.string().trim().optional(),
    })
    .parse(request.body);

  const plate = normalizePlate(body.plate);
  const log = await ParkingCameraLog.findById(logId);
  if (!log) {
    response.status(404).json({ ok: false, message: "Không tìm thấy sự kiện camera." });
    return;
  }
  if (log.direction !== "in") {
    response.status(400).json({
      ok: false,
      message: "Chỉ sự kiện cổng vào mới cần xác nhận.",
    });
    return;
  }
  if (log.entryReviewState !== "pending_review" || log.sessionId) {
    response.status(409).json({
      ok: false,
      message:
        log.entryReviewState === "confirmed"
          ? "Sự kiện đã được xác nhận trước đó."
          : "Sự kiện không còn ở trạng thái chờ xác nhận.",
      sessionId: log.sessionId?.toString() ?? null,
    });
    return;
  }

  const detectedPlate = normalizePlate(log.detectedPlate || log.plate || "");
  const plateCorrected = Boolean(detectedPlate) && plate !== detectedPlate;
  if (plateCorrected && (body.confirmationNote || "").trim().length < 8) {
    response.status(400).json({
      ok: false,
      message: "Cần ghi chú giải thích khi sửa biển số AI nhận sai (tối thiểu 8 ký tự).",
    });
    return;
  }

  // Claim nguyên tử: hai màn hình staff cùng bấm chỉ một request thắng.
  const claimed = await ParkingCameraLog.findOneAndUpdate(
    { _id: log._id, entryReviewState: "pending_review", sessionId: null },
    {
      $set: {
        entryReviewState: "confirmed",
        confirmedPlate: plate,
        ...(body.confirmationNote
          ? { confirmationNote: body.confirmationNote.trim() }
          : {}),
        confirmedBy: request.user?.id,
        confirmedAt: new Date(),
      },
    },
    { new: true },
  );
  if (!claimed) {
    response.status(409).json({
      ok: false,
      message: "Sự kiện vừa được xử lý ở màn hình khác.",
    });
    return;
  }

  const sessionBody: Record<string, unknown> = {
    plate,
    vehicleType: "Ô tô",
    ...(body.rfidUid ? { rfidUid: body.rfidUid } : {}),
    ...(plateCorrected
      ? {
          // Staff sửa biển → luồng manual có minh chứng: ghi chú + ảnh camera.
          entrySource: "manual",
          entryPhotoStatus: log.imagePath
            ? "photo_captured"
            : "camera_unavailable",
          manualEntryReason: (body.confirmationNote || "").trim(),
          visualConfirmed: true,
          ...(body.rfidUid ? {} : { entryRfidUnverified: true }),
        }
      : {
          entrySource: "camera",
          ...(detectedPlate ? { entryDetectedPlate: detectedPlate } : {}),
        }),
    ...(typeof log.confidence === "number"
      ? { entryConfidence: log.confidence }
      : {}),
    ...(log.imagePath ? { entryImageUrl: log.imagePath } : {}),
  };

  // Chuyển tiếp sang createParkingSession để dùng lại toàn bộ kiểm tra
  // RFID/Member/quota/slot; log gốc đã đại diện cho sự kiện nên không tạo
  // log "staff-desk" thứ hai.
  const forwarded = Object.create(request) as Request & {
    suppressEntryReviewLog?: boolean;
  };
  forwarded.body = sessionBody;
  forwarded.suppressEntryReviewLog = true;
  const result = await new Promise<{
    status: number;
    body: Record<string, unknown>;
  }>((resolve, reject) => {
    let settled = false;
    const fakeResponse = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: Record<string, unknown>) {
        if (!settled) {
          settled = true;
          resolve({ status: this.statusCode, body: payload });
        }
        return this;
      },
    };
    createParkingSession(
      forwarded,
      fakeResponse as unknown as Response,
    ).catch((err: unknown) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  }).catch((err: unknown): { status: number; body: Record<string, unknown> } => {
    console.error("[confirmEntryReview] createParkingSession lỗi:", err);
    return { status: 500, body: { message: "Lỗi server khi tạo phiên." } };
  });

  if (result.status !== 201) {
    // Hoàn tất claim để nhân viên còn cơ hội sửa rồi xác nhận lại.
    await ParkingCameraLog.updateOne(
      { _id: claimed._id, sessionId: null },
      {
        $set: { entryReviewState: "pending_review" },
        $unset: { confirmedPlate: "", confirmationNote: "", confirmedBy: "", confirmedAt: "" },
      },
    );
    const message =
      typeof result.body.message === "string"
        ? result.body.message
        : "Không thể tạo phiên cho sự kiện này.";
    response.status(result.status === 200 ? 502 : result.status).json({
      ok: false,
      message,
    });
    return;
  }

  const sessionDoc = result.body.session as { id?: string; _id?: string };
  const sessionId = sessionDoc?.id || sessionDoc?._id;
  if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
    claimed.sessionId = new mongoose.Types.ObjectId(sessionId);
    await claimed.save();
    // Các log pending cùng biển (camera đẩy lặp) đóng theo, tránh "ma" tái
    // xuất hiện trên /staff-desk khi reconnect SSE.
    await ParkingCameraLog.updateMany(
      {
        _id: { $ne: claimed._id },
        direction: "in",
        entryReviewState: "pending_review",
        sessionId: null,
        $or: [{ plate }, ...(detectedPlate ? [{ detectedPlate }] : [])],
      },
      {
        $set: {
          entryReviewState: "dismissed",
          confirmedPlate: plate,
          confirmedBy: request.user?.id,
          confirmedAt: new Date(),
          confirmationNote: "Đóng tự động: sự kiện cùng biển đã được xác nhận.",
        },
      },
    );
  }

  await createAuditLog({
    action: "entry_review_confirmed",
    entityType: "ParkingCameraLog",
    entityId: claimed._id,
    performedBy: request.user?.id ?? "",
    changes: {
      new: {
        plate,
        detectedPlate,
        corrected: plateCorrected,
        rfidUid: body.rfidUid ?? null,
        confirmationNote: body.confirmationNote ?? null,
        sessionId: sessionId ?? null,
      },
    },
  });

  // Cho các màn hình staff khác biết sự kiện đã xử lý qua SSE.
  cameraEventBus.emitIngest({
    id: claimed._id.toString(),
    direction: "in",
    plate,
    detectedPlate,
    confidence: claimed.confidence,
    rfidUid: claimed.rfidUid,
    ownerName: claimed.ownerName,
    userType: (claimed.userType || "unknown") as "resident" | "guest" | "unknown",
    imagePath: claimed.imagePath,
    plateCropPath: claimed.plateCropPath,
    barrierOpened: false,
    sessionId: sessionId ?? null,
    action: "entry_confirmed",
    entryReviewState: "confirmed",
    createdAt: claimed.createdAt.toISOString(),
  });

  response.status(201).json({
    ok: true,
    session: result.body.session,
    isMember: result.body.isMember,
    memberRfidManual: result.body.memberRfidManual,
    subscriptionWarn: result.body.subscriptionWarn,
    review: serializeEntryReview(claimed),
    message: `Đã tạo phiên cho biển ${plate}. Mở barie để xe vào.`,
  });
}

/**
 * POST /api/camera-logs/entry-reviews/:id/dismiss
 * Bỏ qua sự kiện (không tạo phiên, không mở barie).
 */
export async function dismissEntryReview(
  request: Request,
  response: Response,
) {
  const logId = String(request.params.id || "");
  if (!mongoose.Types.ObjectId.isValid(logId)) {
    response.status(400).json({ ok: false, message: "ID sự kiện không hợp lệ." });
    return;
  }
  const updated = await ParkingCameraLog.findOneAndUpdate(
    { _id: logId, direction: "in", entryReviewState: "pending_review" },
    {
      $set: {
        entryReviewState: "dismissed",
        confirmedBy: request.user?.id,
        confirmedAt: new Date(),
      },
    },
    { new: true },
  );
  if (!updated) {
    response.status(409).json({
      ok: false,
      message: "Sự kiện không còn ở trạng thái chờ xác nhận.",
    });
    return;
  }
  // Camera đẩy liên tục các frame OCR cho cùng một xe (mỗi frame là log
  // pending mới). Đóng luôn các frame cùng biển để reconnect SSE không
  // hiện lại thẻ xe mà nhân viên vừa "Bỏ qua".
  const dismissedPlate = normalizePlate(
    updated.plate || updated.detectedPlate || "",
  );
  if (dismissedPlate) {
    await ParkingCameraLog.updateMany(
      {
        _id: { $ne: updated._id },
        direction: "in",
        entryReviewState: "pending_review",
        sessionId: null,
        $or: [{ plate: dismissedPlate }, { detectedPlate: dismissedPlate }],
      },
      {
        $set: {
          entryReviewState: "dismissed",
          confirmedBy: request.user?.id,
          confirmedAt: new Date(),
          confirmationNote: "Đóng tự động: sự kiện cùng biển đã bị bỏ qua.",
        },
      },
    );
  }
  cameraEventBus.emitIngest({
    id: updated._id.toString(),
    direction: "in",
    plate: updated.plate || updated.detectedPlate || "",
    detectedPlate: updated.detectedPlate || "",
    confidence: updated.confidence,
    rfidUid: updated.rfidUid,
    ownerName: updated.ownerName,
    userType: (updated.userType || "unknown") as "resident" | "guest" | "unknown",
    imagePath: updated.imagePath,
    plateCropPath: updated.plateCropPath,
    barrierOpened: false,
    sessionId: null,
    action: "entry_dismissed",
    entryReviewState: "dismissed",
    createdAt: updated.createdAt.toISOString(),
  });
  response.json({ ok: true, review: serializeEntryReview(updated) });
}

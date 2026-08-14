import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { ParkingCameraLog } from "../models/ParkingCameraLog.js";
import {
  ParkingSession,
  ParkingSessionDocument,
} from "../models/ParkingSession.js";
import { RfidCard } from "../models/RfidCard.js";
import { Vehicle } from "../models/Vehicle.js";
import { cameraEventBus } from "../services/camera-event-bus.js";
import {
  allocateSlot,
  freeSlot,
  occupySlot,
} from "../services/parkingSlot.service.js";
import {
  checkSubscriptionDiscountForPlate,
  findActiveSubscriptionByPlate,
  getOwnerInfoFromPlate,
} from "../services/subscription.service.js";
import { createNotification } from "../services/notification.service.js";
import { createPendingTransactionForSession } from "../services/transaction.service.js";
import { serializeParkingSession } from "../utils/serializers.js";
import { calculateParkingFee, getActivePricingConfig } from "../services/pricing.service.js";
import { classifyVehicleByPlate } from "../services/parkingQuota.service.js";

function normalizePlate(plate: string): string {
  return (plate || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

async function ownerFromPlate(plate: string) {
  const vehicle = await Vehicle.findOne({ plate });
  return vehicle?.userId;
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

async function buildSessionForEntry(
  plate: string,
  source: "rfid" | "camera" | "manual",
  rfidUid?: string,
  imagePath?: string,
) {
  const dup = await ParkingSession.findOne({
    plate,
    status: "\u0110ang g\u1EEDi",
  });
  if (dup) return { duplicate: true, session: dup };

  // Camera detection alone must not create a parking session.
  if (source === "camera") return { duplicate: false, cameraOnly: true };

  const rfidCard =
    source === "rfid" && rfidUid
      ? await RfidCard.findOne({ uid: rfidUid.trim() })
      : null;

  if (source === "rfid" && !rfidCard) {
    return {
      duplicate: false,
      invalidRfid: true,
      message: "Kh\u00F4ng t\u00ECm th\u1EA5y th\u1EBB RFID.",
    };
  }

  let quotaAccess = await classifyVehicleByPlate(plate);
  const isMemberRfid = rfidCard?.cardType === "member";

  if (rfidCard) {
    if (isMemberRfid) {
      const memberPlate = normalizePlate(rfidCard.plate || "");
      if (
        rfidCard.status !== "active" ||
        !rfidCard.userId ||
        !rfidCard.vehicleId ||
        !memberPlate
      ) {
        return {
          duplicate: false,
          invalidRfid: true,
          message:
            "Th\u1EBB RFID Member ch\u01B0a s\u1EB5n s\u00E0ng ho\u1EB7c thi\u1EBFu li\u00EAn k\u1EBFt xe/t\u00E0i kho\u1EA3n.",
        };
      }
      if (memberPlate !== plate) {
        return {
          duplicate: false,
          invalidRfid: true,
          message:
            "Bi\u1EC3n s\u1ED1 kh\u00F4ng kh\u1EDBp v\u1EDBi xe g\u1EAFn tr\u00EAn RFID Member.",
        };
      }
      const subscription = await findActiveSubscriptionByPlate(memberPlate);
      if (
        !subscription ||
        subscription.primaryVehicleId !== rfidCard.vehicleId.toString()
      ) {
        return {
          duplicate: false,
          invalidRfid: true,
          message:
            "RFID Member ch\u01B0a c\u00F3 g\u00F3i c\u00F2n hi\u1EC7u l\u1EF1c cho xe n\u00E0y.",
        };
      }
      quotaAccess = { customerType: "member", quotaType: "member" };
    } else {
      const memberSubscription = await findActiveSubscriptionByPlate(plate);
      if (memberSubscription) {
        return {
          duplicate: false,
          invalidRfid: true,
          message: "Xe này đã đăng ký gói thành viên. Vui lòng dùng đúng RFID Member đã liên kết với xe.",
        };
      }
      // Guest RFID always consumes a walk-in slot, even for a registered plate.
      if (!["available", "active"].includes(rfidCard.status)) {
        return {
          duplicate: false,
          invalidRfid: true,
          message:
            "Th\u1EBB RFID Guest ch\u01B0a s\u1EB5n s\u00E0ng \u0111\u1EC3 c\u1EA5p t\u1EA1i c\u1ED5ng.",
        };
      }
      quotaAccess = { customerType: "guest", quotaType: "walk_in" };
    }
  }

  const isSubscriber = quotaAccess.customerType === "member";
  const slotDoc = await allocateSlot("\u00D4 t\u00F4", undefined, {
    isSubscriber,
    quotaType: quotaAccess.quotaType,
  });
  if (!slotDoc) return { duplicate: false, noSlot: true };

  const ownerUserId = isMemberRfid
    ? rfidCard?.userId
    : source === "rfid"
      ? undefined
      : await ownerFromPlate(plate);
  const plateCheck =
    source === "rfid"
      ? { warn: undefined as string | undefined }
      : await checkSubscriptionDiscountForPlate(ownerUserId, plate);
  const isMember = quotaAccess.customerType === "member";
  const { name: ownerName, email: ownerEmail } = isMemberRfid
    ? { name: "Member", email: "" }
    : source === "rfid"
      ? { name: "Guest RFID", email: "" }
      : await getOwnerInfoFromPlate(plate);

  if (plateCheck.warn) {
    await createNotification({
      title: "Subscription plate mismatch",
      content: `Plate ${plate} entered through ${source} but is not covered by a subscription.`,
      targetRole: "staff",
    });
  }

  if (rfidCard && !isMember && (rfidCard.plate || rfidCard.userId || rfidCard.vehicleId)) {
    // RFID Guest dùng chung theo lượt; không mang theo biển/chủ xe của phiên cũ.
    rfidCard.plate = "";
    rfidCard.ownerName = "Guest";
    rfidCard.userId = undefined;
    rfidCard.vehicleId = undefined;
    await rfidCard.save();
  }

  const session = await ParkingSession.create({
    plate,
    ownerName,
    ownerEmail,
    vehicleType: "\u00D4 t\u00F4",
    slot: slotDoc.slotCode,
    slotId: slotDoc._id,
    customerType: quotaAccess.customerType,
    quotaType: quotaAccess.quotaType,
    ...(ownerUserId ? { ownerUserId } : {}),
    ...(rfidCard
      ? {
          rfidCardId: rfidCard.cardId || rfidCard.uid,
          rfidAssignedAt: new Date(),
          rfidGate: "entry" as const,
        }
      : {}),
    entryDetectedPlate: plate,
    entryConfidence: source === "rfid" ? 1 : 0.9,
    ...(imagePath ? { entryImageUrl: imagePath } : {}),
    ...(isMember
      ? {
          paymentStatus: "fully_paid",
          paymentMethod: "subscription",
          fee: 0,
          paidAmount: 0,
        }
      : {}),
    ...(plateCheck.warn
      ? { feeBreakdown: { subscriptionWarn: plateCheck.warn } as any }
      : {}),
  });

  await occupySlot(slotDoc._id, session._id);
  if (rfidCard) {
    rfidCard.status = "in-use";
    rfidCard.lastUsedAt = new Date();
    await rfidCard.save();
  }

  console.log(
    `[buildSessionForEntry] Created session: ${session._id} plate=${plate} source=${source}`,
  );
  return { duplicate: false, session };
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
      barrierOpened: z.boolean().default(false),
      metadata: z.record(z.string(), z.any()).optional(),
    })
    .parse(request.body);

  const plate = normalizePlate(body.plate || body.detectedPlate);
  const detectedPlate = normalizePlate(body.detectedPlate);

  // Tìm RfidCard nếu có
  let rfidCard = null as null | { _id: any; uid: string };
  if (body.rfidUid) {
    rfidCard = await RfidCard.findOne({ uid: body.rfidUid.trim() });
  }

  // Tìm vehicle
  const vehicle = await Vehicle.findOne({ plate });

  let sessionId: any = undefined;
  let action: "created" | "completed" | "skipped" | "no_session" | "invalid_rfid" | "duplicate" = "skipped";
  let failureMessage = "";
  let openSession: typeof ParkingSession.prototype | null = null;

  if (body.direction === "in" && plate) {
    // Chỉ tự tạo phiên khi có biển số — guest chưa có biển sẽ tạo phiên qua ManualPlateCard
    const result = await buildSessionForEntry(
      plate,
      body.rfidUid ? "rfid" : "camera",
      body.rfidUid,
      body.imagePath,
    );
    if (result.duplicate) {
      action = "duplicate";
      sessionId = result.session?._id;
    } else if ((result as any).cameraOnly) {
      // Camera-only detect: không tạo phiên, chỉ hiển thị lên UI để staff xử lý
      action = "skipped";
    } else if (result.noSlot) {
      action = "skipped";
    } else if (result.session) {
      sessionId = result.session._id;
      action = "created";
    } else if ((result as any).invalidRfid) {
      action = "invalid_rfid";
      failureMessage = (result as any).message || "RFID không hợp lệ.";
    } else if ((result as any).noSlot) {
      failureMessage = "Bãi xe không còn slot phù hợp cho xe Guest.";
    }
    console.log(
      `[pushCameraLog] direction=in plate=${plate} rfidUid=${body.rfidUid ?? "none"} action=${action} sessionId=${sessionId ?? "none"}`,
    );
  } else if (body.direction !== "in") {
    // OUT: tìm phiên đang mở gần nhất theo biển số
    openSession = await ParkingSession.findOne({ $or: [{ plate }, { entryDetectedPlate: plate }, { manualPlate: plate }], status: "Đang gửi" }).sort({ checkInAt: -1 });
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
      // Đánh dấu đang chờ xác minh RFID — KHÔNG finalize, KHÔNG freeSlot
      openSession.exitState = "waiting_rfid";
      openSession.exitDetectedAt = new Date();
      // Tính phí dự kiến (hiển thị trên UI)
      if (openSession.paymentStatus !== "fully_paid") {
        const pricing = await getActivePricingConfig();
        const feeBreakdown = calculateParkingFee(
          openSession.checkInAt,
          new Date(),
          pricing,
        );
        openSession.fee = feeBreakdown.totalFee;
        openSession.feeBreakdown = feeBreakdown;
      }
      await openSession.save();
      sessionId = openSession._id;
      action = "skipped"; // skipped = camera detect, chưa finalize
    } else {
      action = "no_session";
    }
  }

  const log = await ParkingCameraLog.create({
    direction: body.direction,
    detectedPlate,
    confidence: body.confidence,
    rfidUid: body.rfidUid,
    ownerName: body.ownerName || (rfidCard?.uid ? "" : ""),
    plate,
    userType: body.userType,
    imagePath: body.imagePath,
    barrierOpened: body.barrierOpened,
    sessionId,
    vehicleId: vehicle?._id,
    rfidCardId: rfidCard?._id,
    metadata: body.metadata,
  });

  // Realtime push tới /staff-desk qua SSE bus cho cả cổng vào và cổng ra.
  const activeMemberSubscription = plate ? await findActiveSubscriptionByPlate(plate) : null;
  const memberCardForPlate = activeMemberSubscription ? await RfidCard.findOne({ plate, cardType: "member", status: { $in: ["active", "in-use"] } }).select("uid") : null;
  const eventUserType = openSession?.customerType === "member" || activeMemberSubscription ? "resident" : body.userType;
  const eventOwnerName = openSession?.ownerName || body.ownerName || vehicle?.ownerName || "Chưa xác định";
  const eventMetadata = { ...(body.metadata ?? {}), ...(activeMemberSubscription ? { isSubscriber: true, expectedRfidUid: memberCardForPlate?.uid ?? null } : {}) };
  const isExitWaiting =
    body.direction === "out" && action === "skipped" && sessionId;
  cameraEventBus.emitIngest({
    id: log._id.toString(),
    direction: body.direction,
    plate,
    detectedPlate,
    confidence: body.confidence,
    rfidUid: body.rfidUid,
    ownerName: eventOwnerName,
    userType: eventUserType,
    imagePath: body.imagePath,
    barrierOpened: body.barrierOpened,
    sessionId: sessionId?.toString() ?? null,
    checkInAt: openSession?.checkInAt?.toISOString() ?? null,
    sessionStatus:
      action === "created"
        ? "Đang gửi"
        : isExitWaiting
          ? "Đang gửi"
          : (action as string) === "completed"
            ? "Đã hoàn thành"
            : null,
    exitState: isExitWaiting ? "waiting_rfid" : null,
    action: isExitWaiting ? "waiting_rfid" : action,
    sessionPaymentStatus: isExitWaiting ? "pending" : null,
    duplicateSession: action === "duplicate",
    metadata: { ...eventMetadata, customerType: openSession?.customerType ?? (activeMemberSubscription ? "member" : "guest") },

    fee: isExitWaiting ? ((openSession as any)?.fee ?? null) : null,
    createdAt: log.createdAt.toISOString(),
  });

  const rejected = action === "invalid_rfid" || action === "duplicate" || action === "skipped";
  response.status(rejected ? 409 : 201).json({
    ok: !rejected,
    log: {
      id: log._id.toString(),
      direction: log.direction,
      plate: log.plate,
      detectedPlate: log.detectedPlate,
      action,
      sessionId: sessionId?.toString(),
    },
    message:
      action === "created"
        ? `Đã mở phiên cho biển ${plate}`
        : (action as string) === "completed"
          ? `Đã checkout phiên cho biển ${plate}`
          : (action as string) === "duplicate"
          ? `Xe ${plate} đang có phiên gửi trong bãi. Từ chối vào.` 
          : (action as string) === "invalid_rfid"
          ? failureMessage || "RFID không hợp lệ với biển số hoặc gói thành viên của xe này."
          : (action as string) === "no_session"
            ? `Không tìm thấy phiên đang gửi cho biển ${plate}`
        : `Không thể tạo phiên cho biển ${plate}: bãi có thể đã hết chỗ phù hợp.`,
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
 * Bridge ghi nhận barrier open/close (manual). Không tạo ParkingCameraLog
 * vì log này dành cho camera detect biển số — manual gate không có detectedPlate.
 * Nếu cần audit trail cho manual gate, mở rộng thêm collection riêng sau.
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
  // Audit qua console (chưa cần collection riêng)
  // eslint-disable-next-line no-console
  console.log(
    `[bridge.gate] direction=${direction} action=${action} ts=${new Date().toISOString()}`,
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

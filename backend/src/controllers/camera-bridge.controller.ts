import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { ParkingCameraLog } from "../models/ParkingCameraLog.js";
import { ParkingSession, ParkingSessionDocument } from "../models/ParkingSession.js";
import { RfidCard } from "../models/RfidCard.js";
import { Vehicle } from "../models/Vehicle.js";
<<<<<<< Updated upstream
import { allocateSlot, freeSlot, occupySlot } from "../services/parkingSlot.service.js";
import { checkSubscriptionDiscountForPlate, findActiveSubscriptionByPlate, getOwnerInfoFromPlate } from "../services/subscription.service.js";
import { createNotification } from "../services/notification.service.js";
import { createPendingTransactionForSession } from "../services/transaction.service.js";
import { serializeParkingSession } from "../utils/serializers.js";
=======
import { allocateCarSlot, canEnterParking } from "../config/parking.js";
import { createNotification } from "../services/notification.service.js";
import { createPendingTransactionForSession } from "../services/transaction.service.js";
>>>>>>> Stashed changes

function normalizePlate(plate: string): string {
  return (plate || "").trim().toUpperCase().replace(/[\s-]+/g, "");
}

async function ownerFromPlate(plate: string) {
  const vehicle = await Vehicle.findOne({ plate });
  return vehicle?.userId;
}

/**
 * Tính phí theo giờ đơn giản (dùng cho checkout từ bridge).
 * Trả về fee = max(0, (số phút - free) / 60 * rate) làm tròn lên.
 */
function calcSimpleFee(checkInAt: Date, checkOutAt: Date, hourlyRate = 5000, freeMinutes = 15): number {
  const minutes = Math.max(0, Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
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
<<<<<<< Updated upstream
  // AI-09: Duplicate detection
=======
  // Duplicate detection
>>>>>>> Stashed changes
  const dup = await ParkingSession.findOne({ plate, status: "Đang gửi" });
  if (dup) {
    return { duplicate: true, session: dup };
  }

<<<<<<< Updated upstream
  // Xác định isSubscriber (để allocate slot và check member fee).
  // Ưu tiên theo thẻ RFID: nếu thẻ là resident → resident (vào slot resident/shared);
  // nếu thẻ là guest → guest/shared. Khi không có thẻ, check theo biển có trong subscription.
  let isSubscriber = false;
  let rfidCard: { userType: "resident" | "guest" } | null = null;
  if (rfidUid) {
    const card = await RfidCard.findOne({ uid: rfidUid.trim() });
    if (card) {
      rfidCard = { userType: card.userType };
      isSubscriber = card.userType === "resident";
    }
  }
  if (!rfidCard) {
    const sub = await findActiveSubscriptionByPlate(plate);
    isSubscriber = !!sub;
  }

  const slotDoc = await allocateSlot("Ô tô", undefined, { isSubscriber });
  if (!slotDoc) {
    return { duplicate: false, noSlot: true };
  }

  const ownerUserId = await ownerFromPlate(plate);
  const plateCheck = await checkSubscriptionDiscountForPlate(ownerUserId, plate);
  const isMember = plateCheck.discount === 100;
  const { name: ownerName, email: ownerEmail } = await getOwnerInfoFromPlate(plate);

  if (plateCheck.warn) {
    await createNotification({
      title: "Biển số không thuộc gói thành viên",
      content: `Biển số ${plate} vào bãi qua ${source} nhưng KHÔNG thuộc danh sách đăng ký.`,
      targetRole: "staff",
    });
  }
=======
  let isSubscriber = false;
  let rfidCard: { userType: "resident" | "guest" } | null = null;
  if (rfidUid) {
    const card = await RfidCard.findOne({ cardId: rfidUid.trim() });
    if (card) {
      rfidCard = { userType: card.status === "in-use" ? "resident" : "guest" };
      isSubscriber = card.status === "in-use";
    }
  }

  const activeCount = await ParkingSession.countDocuments({ status: "Đang gửi" });
  const capacityCheck = await canEnterParking(isSubscriber, activeCount);
  if (!capacityCheck.allowed) {
    return { duplicate: false, noSlot: true, reason: capacityCheck.reason };
  }

  const ownerUserId = await ownerFromPlate(plate);
  const vehicle = await Vehicle.findOne({ plate });
  const ownerName = vehicle?.ownerName || "Khách vãng lai";
  const ownerEmail = "";

  const slotCode = allocateCarSlot(activeCount);
>>>>>>> Stashed changes

  const session = await ParkingSession.create({
    plate,
    ownerName,
    ownerEmail,
    vehicleType: "Ô tô",
<<<<<<< Updated upstream
    slot: slotDoc.slotCode,
    slotId: slotDoc._id,
=======
    slot: slotCode,
>>>>>>> Stashed changes
    ownerUserId,
    entryDetectedPlate: plate,
    entryConfidence: source === "camera" ? 0.9 : 1,
    ...(imagePath ? { entryImageUrl: imagePath } : {}),
<<<<<<< Updated upstream
    ...(isMember
      ? { paymentStatus: "fully_paid", paymentMethod: "subscription", fee: 0, paidAmount: 0 }
      : {}),
    ...(plateCheck.warn ? { feeBreakdown: { subscriptionWarn: plateCheck.warn } as any } : {}),
  });

  await occupySlot(slotDoc._id, session._id);

  return { duplicate: false, session };
}

/**
 * Xử lý checkout cho phiên đang đỗ.
 * Bridge không có AI service đầy đủ nên dùng giá đơn giản (giờ * 5000).
 */
=======
    ...(isSubscriber ? { paymentStatus: "paid", fee: 0, paidAmount: 0 } : {}),
  });

  return { duplicate: false, session };
}

>>>>>>> Stashed changes
async function finalizeBridgeCheckout(session: ParkingSessionDocument) {
  session.status = "Đã hoàn thành";
  session.checkOutAt = new Date();

<<<<<<< Updated upstream
  if (session.paymentStatus !== "fully_paid") {
=======
  if (session.paymentStatus !== "paid") {
>>>>>>> Stashed changes
    session.fee = calcSimpleFee(session.checkInAt, session.checkOutAt);
    session.feeBreakdown = {
      totalMinutes: Math.max(0, Math.floor((session.checkOutAt.getTime() - session.checkInAt.getTime()) / 60000)),
      freeMinutes: 15,
      billableMinutes: Math.max(0, Math.floor((session.checkOutAt.getTime() - session.checkInAt.getTime()) / 60000) - 15),
      billableHours: Math.ceil(Math.max(0, Math.floor((session.checkOutAt.getTime() - session.checkInAt.getTime()) / 60000) - 15) / 60),
      hourlyRate: 5000,
      parkingFee: session.fee,
      overdueFine: 0,
      totalFee: session.fee,
<<<<<<< Updated upstream
      dailyBreakdown: [],
=======
>>>>>>> Stashed changes
    };
    await createPendingTransactionForSession(session);
  }

<<<<<<< Updated upstream
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
=======
  return session;
}

>>>>>>> Stashed changes
export async function pushCameraLog(request: Request, response: Response) {
  const body = z
    .object({
      direction: z.enum(["in", "out"]),
      detectedPlate: z.string().trim().min(1),
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

<<<<<<< Updated upstream
  // Tìm RfidCard nếu có
  let rfidCard = null as null | { _id: any; uid: string };
  if (body.rfidUid) {
    rfidCard = await RfidCard.findOne({ uid: body.rfidUid.trim() });
  }

  // Tìm vehicle
=======
  let rfidCard = null as null | { _id: any; cardId: string };
  if (body.rfidUid) {
    rfidCard = await RfidCard.findOne({ cardId: body.rfidUid.trim() });
  }

>>>>>>> Stashed changes
  const vehicle = await Vehicle.findOne({ plate });

  let sessionId: any = undefined;
  let action: "created" | "completed" | "skipped" = "skipped";

  if (body.direction === "in") {
    const result = await buildSessionForEntry(
      plate,
      body.rfidUid ? "rfid" : "camera",
      body.rfidUid,
      body.imagePath,
    );
    if (result.duplicate) {
      action = "skipped";
      sessionId = result.session?._id;
    } else if (result.noSlot) {
      action = "skipped";
    } else if (result.session) {
      sessionId = result.session._id;
      action = "created";
    }
  } else {
<<<<<<< Updated upstream
    // OUT: tìm phiên đang mở gần nhất theo biển số
    const openSession = await ParkingSession.findOne({ plate, status: "Đang gửi" }).sort({ checkInAt: -1 });
    if (openSession) {
      // Gán ảnh ra từ camera vào phiên trước khi finalize.
      // Bridge gửi imagePath = path tương đối dưới /uploads/cameras/<file>.jpg
=======
    const openSession = await ParkingSession.findOne({ plate, status: "Đang gửi" }).sort({ checkInAt: -1 });
    if (openSession) {
>>>>>>> Stashed changes
      if (body.imagePath) {
        openSession.exitImageUrl = body.imagePath;
      }
      if (detectedPlate) {
        openSession.exitDetectedPlate = detectedPlate;
      }
      if (typeof body.confidence === "number") {
        openSession.exitConfidence = body.confidence;
      }
      await finalizeBridgeCheckout(openSession);
      await openSession.save();
      sessionId = openSession._id;
      action = "completed";
    } else {
      action = "skipped";
    }
  }

  const log = await ParkingCameraLog.create({
    direction: body.direction,
    detectedPlate,
    confidence: body.confidence,
    rfidUid: body.rfidUid,
<<<<<<< Updated upstream
    ownerName: body.ownerName || (rfidCard?.uid ? "" : ""),
=======
    ownerName: body.ownerName || (rfidCard?.cardId ? "" : ""),
>>>>>>> Stashed changes
    plate,
    userType: body.userType,
    imagePath: body.imagePath,
    barrierOpened: body.barrierOpened,
    sessionId,
    vehicleId: vehicle?._id,
    rfidCardId: rfidCard?._id,
    metadata: body.metadata,
  });

  response.status(201).json({
    ok: true,
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
        : action === "completed"
        ? `Đã checkout phiên cho biển ${plate}`
        : `Không có thay đổi (duplicate/noSlot/noSession)`,
  });
}

<<<<<<< Updated upstream
/**
 * GET /api/bridge/logs?limit=20
 * Trả về log gần nhất cho dashboard.
 */
=======
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
/**
 * DELETE /api/bridge/logs
 * Xóa toàn bộ nhật ký camera (chỉ admin).
 */
=======
>>>>>>> Stashed changes
export async function clearCameraLogs(request: Request, response: Response) {
  const result = await ParkingCameraLog.deleteMany({});
  response.json({
    ok: true,
    deleted: result.deletedCount ?? 0,
    message: `Đã xóa ${result.deletedCount ?? 0} bản ghi nhật ký camera.`,
  });
}

<<<<<<< Updated upstream
/**
 * POST /api/bridge/gate/:direction/:action
 * Bridge ghi nhận barrier open/close (manual). Không tạo ParkingCameraLog
 * vì log này dành cho camera detect biển số — manual gate không có detectedPlate.
 * Nếu cần audit trail cho manual gate, mở rộng thêm collection riêng sau.
 */
=======
>>>>>>> Stashed changes
export async function bridgeGateControl(request: Request, response: Response) {
  const direction = String(request.params.direction || "");
  const action = String(request.params.action || "");
  if (!["in", "out"].includes(direction) || !["open", "close"].includes(action)) {
    response.status(400).json({ ok: false, message: "Invalid direction or action" });
    return;
  }
<<<<<<< Updated upstream
  // Audit qua console (chưa cần collection riêng)
  // eslint-disable-next-line no-console
=======
>>>>>>> Stashed changes
  console.log(
    `[bridge.gate] direction=${direction} action=${action} ts=${new Date().toISOString()}`,
  );
  response.json({ ok: true, message: `Gate ${direction} ${action} recorded` });
}

<<<<<<< Updated upstream
/**
 * GET /api/bridge/health
 * Kiểm tra Python service có gọi được backend không.
 */
=======
>>>>>>> Stashed changes
export async function bridgeHealth(_request: Request, response: Response) {
  response.json({
    ok: true,
    service: "ipark-bridge",
    backend: "ipark-backend",
    timestamp: new Date().toISOString(),
  });
<<<<<<< Updated upstream
}
=======
}
>>>>>>> Stashed changes

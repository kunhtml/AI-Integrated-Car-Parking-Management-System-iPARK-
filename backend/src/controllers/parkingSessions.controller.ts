import { Request, Response } from "express";
import { z } from "zod";
import { parkingConfig } from "../config/parking.js";
import { Device } from "../models/Device.js";
import { ParkingCameraLog } from "../models/ParkingCameraLog.js";
import { ParkingSlot } from "../models/ParkingSlot.js";
import {
  ParkingSession,
  ParkingSessionDocument,
} from "../models/ParkingSession.js";
import { RfidCard } from "../models/RfidCard.js";
import { Vehicle } from "../models/Vehicle.js";
import { detectVehicleImage } from "../services/ai.service.js";
import { captureDeviceSnapshot } from "../services/device.service.js";
import { createNotification } from "../services/notification.service.js";
import { imageHashSimilarity, platesMatch } from "../services/plate.service.js";
import {
  allocateSlot,
  freeSlot,
  occupySlot,
} from "../services/parkingSlot.service.js";
import {
  calculateParkingFee,
  getActivePricingConfigForZone,
} from "../services/pricing.service.js";
import {
  checkSubscriptionDiscountForPlate,
  findActiveSubscriptionByPlate,
  getOwnerInfoFromPlate,
} from "../services/subscription.service.js";
import {
  createPendingTransactionForSession,
  objectId,
} from "../services/transaction.service.js";
import { Transaction, TransactionDocument } from "../models/Transaction.js";
import { saveUploadedImage } from "../services/upload.service.js";
import { serializeParkingSession } from "../utils/serializers.js";
import { classifyVehicleByPlate } from "../services/parkingQuota.service.js";

async function finalizeCheckout(session: ParkingSessionDocument) {
  session.status = "Đã hoàn thành";
  session.checkOutAt = new Date();

  // Đã trả đủ trước đó (prepaid) → chỉ hoàn tất + nhả slot, KHÔNG tính lại phí.
  if (session.paymentStatus === "fully_paid") {
    await freeSlot(session.slotId);
    return session;
  }

  // Look up zone via slot for zone-specific pricing
  const slotDoc = session.slotId
    ? await ParkingSlot.findById(session.slotId)
    : null;
  const pricing = await getActivePricingConfigForZone(slotDoc?.zoneId);
  const feeBreakdown = calculateParkingFee(
    session.checkInAt,
    session.checkOutAt,
    pricing,
  );
  session.fee = feeBreakdown.totalFee;
  session.feeBreakdown = feeBreakdown;

  // PM-05: Add overdue fine if applicable
  if (
    session.isOverstayed &&
    session.overdueMinutes &&
    session.overdueMinutes > 0
  ) {
    const { calculateOverdueFine } =
      await import("../services/overdue.service.js");
    const overdueResult = calculateOverdueFine(
      session.checkInAt,
      session.checkOutAt!,
      {
        gracePeriod: (pricing as any).gracePeriod ?? 0,
      },
    );
    if (overdueResult.fineAmount > 0) {
      session.fee += overdueResult.fineAmount;
      (session.feeBreakdown as any).overdueFine = overdueResult.fineAmount;
    }
  }

  // Customer/quota type is fixed at check-in; do not reclassify or discount at checkout.

  // Cộng vé phạt đang chờ của phiên này vào phí (khách vãng lai trả gộp khi ra).
  // Làm SAU khi đã tính phí gửi + giảm giá để phần phạt không bị ghi đè/giảm.
  const { Penalty } = await import("../models/Penalty.js");
  const pendingPenalties = await Penalty.find({
    sessionId: session._id,
    status: "pending",
  });
  const penaltyFine = pendingPenalties.reduce(
    (sum, p) => sum + (p.amount || 0),
    0,
  );
  if (penaltyFine > 0) {
    session.fee += penaltyFine;
    const breakdown = (session.feeBreakdown ?? ({} as any)) as Record<
      string,
      unknown
    >;
    breakdown.penaltyFine = penaltyFine;
    session.feeBreakdown = breakdown as any;
  }

  await createPendingTransactionForSession(session);
  // Release the slot
  await freeSlot(session.slotId);
  return session;
}

function snapshotAsFile(snapshot: {
  buffer: Buffer;
  mimetype: string;
}): Express.Multer.File {
  return {
    buffer: snapshot.buffer,
    mimetype: snapshot.mimetype,
    originalname: "camera-snapshot.jpg",
  } as Express.Multer.File;
}

async function ownerFromPlate(plate: string) {
  const vehicle = await Vehicle.findOne({ plate: plate.toUpperCase() });
  return vehicle?.userId;
}

/**
 * AI-09: Check for duplicate plate — same plate already active in parking.
 */
async function checkDuplicatePlate(plate: string): Promise<boolean> {
  const existing = await ParkingSession.findOne({
    plate: plate.toUpperCase(),
    status: "Đang gửi",
  });
  return !!existing;
}

/**
 * Detect xem biển số có thuộc cư dân có gói active hay không.
 * Dùng để phân bổ slot theo accessPolicy.
 */
async function isSubscriberByPlate(plate: string): Promise<boolean> {
  const sub = await findActiveSubscriptionByPlate(plate);
  return !!sub;
}

export async function listParkingSessions(
  request: Request,
  response: Response,
) {
  const criteria =
    request.user?.role === "customer" ? { ownerUserId: request.user.id } : {};
  const sessions = await ParkingSession.find(criteria)
    .sort({ createdAt: -1 })
    .limit(100);
  const sessionsWithTransactions = await ParkingSession.find(criteria)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate<{ transactionId: TransactionDocument | null }>("transactionId");

  response.json({
    sessions: sessionsWithTransactions.map((session) => ({
      ...serializeParkingSession(session as unknown as ParkingSessionDocument),
      transactionStatus: session.transactionId?.status ?? null,
    })),
  });
}

export async function createParkingSession(
  request: Request,
  response: Response,
) {
  const body = z
    .object({
      plate: z.string().min(5),
      vehicleType: z.literal("\u00D4 t\u00F4").default("\u00D4 t\u00F4"),
      rfidUid: z.string().trim().optional(),
      entryDetectedPlate: z.string().trim().optional(),
      entryConfidence: z.number().min(0).max(1).optional(),
      entryImageUrl: z.string().trim().optional(),
    })
    .parse(request.body);

  const normalizeRfidPlate = (value: string) =>
    value.trim().toUpperCase().replace(/[\s-]+/g, "");

  if (await checkDuplicatePlate(body.plate)) {
    response.status(409).json({
      message: `Bi\u1EC3n s\u1ED1 ${body.plate} \u0111ang c\u00F3 phi\u00EAn \u0111\u1ED7 xe ch\u01B0a checkout.`,
    });
    return;
  }

  let rfidCard: {
    _id: any;
    uid: string;
    cardId?: string;
    cardType: "guest" | "member";
    userType: "resident" | "guest";
    userId?: any;
    vehicleId?: any;
    plate?: string;
    status: string;
  } | null = null;

  let quotaAccess = await classifyVehicleByPlate(body.plate);
  let isMember = quotaAccess.customerType === "member";
  let ownerUserId = await ownerFromPlate(body.plate);
  let plateCheck = await checkSubscriptionDiscountForPlate(
    ownerUserId,
    body.plate,
  );

  if (body.rfidUid) {
    const card = await RfidCard.findOne({ uid: body.rfidUid.trim() });
    if (!card) {
      response.status(404).json({
        message: `Kh\u00F4ng t\u00ECm th\u1EA5y th\u1EBB RFID v\u1EDBi UID ${body.rfidUid}.`,
      });
      return;
    }

    const isMemberCard = card.cardType === "member";
    const cardPlate = normalizeRfidPlate(card.plate || "");
    if (isMemberCard) {
      if (
        card.status !== "active" ||
        !card.userId ||
        !card.vehicleId ||
        !cardPlate ||
        cardPlate !== normalizeRfidPlate(body.plate)
      ) {
        response.status(409).json({
          message:
            "RFID Member ph\u1EA3i \u1EDF tr\u1EA1ng th\u00E1i active v\u00E0 g\u1EAFn \u0111\u00FAng xe/t\u00E0i kho\u1EA3n.",
        });
        return;
      }

      if (
        body.entryDetectedPlate &&
        normalizeRfidPlate(body.entryDetectedPlate) !== cardPlate
      ) {
        response.status(409).json({
          message:
            "Bi\u1EC3n s\u1ED1 camera ph\u00E1t hi\u1EC7n kh\u00F4ng kh\u1EDBp v\u1EDBi xe c\u1EE7a RFID Member.",
        });
        return;
      }

      const vehicle = await Vehicle.findOne({
        _id: card.vehicleId,
        userId: card.userId,
        plate: cardPlate,
      });
      const subscription = await findActiveSubscriptionByPlate(cardPlate);
      if (
        !vehicle ||
        !subscription ||
        subscription.primaryVehicleId !== card.vehicleId.toString()
      ) {
        response.status(409).json({
          message:
            "RFID Member ch\u01B0a c\u00F3 xe ho\u1EB7c g\u00F3i th\u00E0nh vi\u00EAn c\u00F2n hi\u1EC7u l\u1EF1c.",
        });
        return;
      }

      quotaAccess = { customerType: "member", quotaType: "member" };
      isMember = true;
      ownerUserId = card.userId;
      plateCheck = { warn: undefined, discount: 0 };
    } else {
      const memberSubscription = await findActiveSubscriptionByPlate(normalizeRfidPlate(body.plate));
      if (memberSubscription) {
        response.status(409).json({
          message: "Xe này đã đăng ký gói thành viên. Vui lòng dùng đúng RFID Member đã liên kết với xe.",
        });
        return;
      }
      if (!["available", "active"].includes(card.status)) {
        response.status(409).json({
          message: "RFID Guest ch\u01B0a s\u1EB5n s\u00E0ng \u0111\u1EC3 c\u1EA5p phi\u00EAn g\u1EEDi xe.",
        });
        return;
      }
      // A guest card must never use a member slot or subscription payment.
      quotaAccess = { customerType: "guest", quotaType: "walk_in" };
      isMember = false;
      ownerUserId = undefined;
      plateCheck = { warn: undefined, discount: 0 };

      // Biển của Guest thuộc phiên, không thuộc thẻ dùng chung. Dọn dữ liệu
      // còn sót từ phiên trước trước khi cấp thẻ cho xe mới.
      if (card.plate || card.userId || card.vehicleId) {
        card.plate = "";
        card.ownerName = "Guest";
        card.userId = undefined;
        card.vehicleId = undefined;
        await card.save();
      }
    }

    rfidCard = {
      _id: card._id,
      uid: card.uid,
      cardId: card.cardId,
      cardType: card.cardType,
      userType: card.userType,
      userId: card.userId,
      vehicleId: card.vehicleId,
      plate: card.plate,
      status: card.status,
    };
  }

  const isSubscriber = quotaAccess.customerType === "member";
  const slotDoc = await allocateSlot("\u00D4 t\u00F4", undefined, {
    isSubscriber,
    quotaType: quotaAccess.quotaType,
  });
  if (!slotDoc) {
    response.status(409).json({ message: "B\u00E3i xe \u0111\u00E3 h\u1EBFt ch\u1ED7 tr\u1ED1ng." });
    return;
  }

  const { name: ownerName, email: ownerEmail } = rfidCard
    ? isMember
      ? await getOwnerInfoFromPlate(body.plate)
      : { name: "Guest RFID", email: "" }
    : await getOwnerInfoFromPlate(body.plate);

  if (plateCheck.warn) {
    await createNotification({
      title: "Subscription plate mismatch",
      content: `Plate ${body.plate} entered but is not covered by a subscription.`,
      targetRole: "staff",
    });
  }

  const session = await ParkingSession.create({
    plate: body.plate,
    ownerName,
    ownerEmail,
    vehicleType: "\u00D4 t\u00F4",
    slot: slotDoc.slotCode,
    slotId: slotDoc._id,
    customerType: quotaAccess.customerType,
    quotaType: quotaAccess.quotaType,
    ...(ownerUserId ? { ownerUserId } : {}),
    createdBy: request.user?.id,
    checkInStaff: request.user?.id,
    ...(rfidCard
      ? {
          rfidCardId: rfidCard.cardId || rfidCard.uid,
          rfidAssignedAt: new Date(),
          rfidGate: "entry" as const,
        }
      : {}),
    ...(body.entryDetectedPlate
      ? { entryDetectedPlate: body.entryDetectedPlate.toUpperCase() }
      : {}),
    ...(typeof body.entryConfidence === "number"
      ? { entryConfidence: body.entryConfidence }
      : {}),
    ...(body.entryImageUrl ? { entryImageUrl: body.entryImageUrl } : {}),
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
    await RfidCard.updateOne(
      { _id: rfidCard._id },
      { $set: { status: "in-use", lastUsedAt: new Date() } },
    );
  }

  if (body.rfidUid || body.entryImageUrl) {
    const vehicle = await Vehicle.findOne({ plate: body.plate.toUpperCase() });
    await ParkingCameraLog.create({
      direction: "in",
      detectedPlate: (body.entryDetectedPlate || body.plate).toUpperCase(),
      confidence: body.entryConfidence,
      rfidUid: body.rfidUid,
      ownerName,
      plate: body.plate.toUpperCase(),
      userType: rfidCard?.userType ?? "unknown",
      imagePath: body.entryImageUrl,
      barrierOpened: false,
      sessionId: session._id,
      vehicleId: vehicle?._id,
      rfidCardId: rfidCard?._id,
      metadata: { source: "staff-desk", staffId: request.user?.id },
    });
  }

  response.status(201).json({
    session: serializeParkingSession(session),
    isMember,
    ...(plateCheck.warn ? { subscriptionWarn: plateCheck.warn } : {}),
  });
}
export async function completeParkingSession(
  request: Request,
  response: Response,
) {
  const body = z
    .object({
      id: z.string().min(1),
      // Tuỳ chọn: ảnh checkout + biển AI detect khi staff checkout thủ công từ UI
      exitImageUrl: z.string().trim().optional(),
      exitDetectedPlate: z.string().trim().optional(),
      exitConfidence: z.number().min(0).max(1).optional(),
      exitImageHash: z.string().trim().optional(),
    })
    .parse(request.body);
  const session = await ParkingSession.findById(body.id);
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên." });
    return;
  }

  await finalizeCheckout(session);
  // Ghi đè các trường ảnh checkout nếu payload cung cấp (ưu tiên ảnh mới hơn bridge)
  if (body.exitImageUrl) session.exitImageUrl = body.exitImageUrl;
  if (body.exitDetectedPlate)
    session.exitDetectedPlate = body.exitDetectedPlate.toUpperCase();
  if (typeof body.exitConfidence === "number")
    session.exitConfidence = body.exitConfidence;
  if (body.exitImageHash) session.exitImageHash = body.exitImageHash;
  await session.save();

  response.json({ session: serializeParkingSession(session) });
}

export async function uploadParkingImage(request: Request, response: Response) {
  const action = String(request.body.action || "");
  const image = request.file;

  if (!image) {
    response.status(400).json({ message: "Thiếu ảnh xe." });
    return;
  }

  const detection = await detectVehicleImage(image);
  if (!detection.plate) {
    response.status(422).json({
      message:
        "Không nhận diện được biển số. Vui lòng upload ảnh rõ hơn hoặc xác minh thủ công.",
    });
    return;
  }

  if (action === "entry") {
    // AI-09: Duplicate plate detection
    if (await checkDuplicatePlate(detection.plate)) {
      response.status(409).json({
        message: `Biển số ${detection.plate} đang có phiên đỗ xe chưa checkout. Không thể tạo phiên mới.`,
      });
      return;
    }

    const isSubscriber = await isSubscriberByPlate(detection.plate);
    const quotaAccess = await classifyVehicleByPlate(detection.plate);
    const slotDoc = await allocateSlot("Ô tô", undefined, { isSubscriber, quotaType: quotaAccess.quotaType });
    if (!slotDoc) {
      response.status(409).json({ message: "Bãi xe đã hết chỗ trống." });
      return;
    }

    const imageUrl = await saveUploadedImage(image, "entry");

    // Tự động tra cứu biển số trong tất cả subscription còn hiệu lực.
    // Nếu biển thuộc danh sách đăng ký → set isMember, fee = 0, không cần nhập mã.
    // Nếu biển KHÔNG thuộc → vẫn cho vào, tính phí như khách vãng lai.
    let isMember = false;
    let memberUserId: string | undefined;
    let subscriptionWarn: string | undefined;
    const foundSub = await findActiveSubscriptionByPlate(detection.plate);
    if (foundSub) {
      isMember = true;
      memberUserId = foundSub.userId;
    }

    const { name: ownerName, email: ownerEmail } = await getOwnerInfoFromPlate(
      detection.plate,
      request.body.email,
    );

    const session = await ParkingSession.create({
      plate: detection.plate,
      ownerName,
      ownerEmail,
      vehicleType: "Ô tô",
      slot: slotDoc.slotCode,
      slotId: slotDoc._id,
      customerType: quotaAccess.customerType,
      quotaType: quotaAccess.quotaType,
      entryImageUrl: imageUrl,
      entryDetectedPlate: detection.plate,
      entryConfidence: detection.confidence,
      entryImageHash: detection.imageHash,
      aiRawText: detection.rawText,
      ownerUserId: memberUserId || (await ownerFromPlate(detection.plate)),
      createdBy: request.user?.id,
      ...(isMember
        ? {
            paymentStatus: "fully_paid",
            paymentMethod: "subscription",
            fee: 0,
            paidAmount: 0,
          }
        : {}),
      ...(subscriptionWarn
        ? { feeBreakdown: { subscriptionWarn } as any }
        : {}),
    });

    await occupySlot(slotDoc._id, session._id);

    response.status(201).json({
      session: serializeParkingSession(session),
      detection,
      isMember,
      ...(subscriptionWarn ? { subscriptionWarn } : {}),
    });
    return;
  }

  if (action === "exit") {
    const session = await ParkingSession.findById(
      String(request.body.sessionId || ""),
    );
    if (!session) {
      response.status(404).json({ message: "Không tìm thấy phiên đỗ xe." });
      return;
    }

    const matched = platesMatch(
      session.entryDetectedPlate || session.plate,
      detection.plate,
    );
    const vehicleScore = imageHashSimilarity(
      session.entryImageHash,
      detection.imageHash,
    );
    const imageUrl = await saveUploadedImage(image, "exit");

    session.exitImageUrl = imageUrl;
    session.exitDetectedPlate = detection.plate;
    session.exitConfidence = detection.confidence;
    session.exitImageHash = detection.imageHash;
    session.vehicleMatchScore = vehicleScore;
    session.matchStatus = matched ? "Khớp" : "Không khớp";
    session.verificationStatus = matched ? "Không cần" : "Chờ duyệt";

    if (matched) {
      await finalizeCheckout(session);
    } else {
      await createNotification({
        title: "Checkout cần admin duyệt",
        content: `Phiên ${session._id.toString()} OCR ra ${detection.plate} không khớp ${session.plate}.`,
        targetRole: "admin",
      });
    }

    await session.save();
    response.json({
      session: serializeParkingSession(session),
      detection,
      matched,
      message: matched
        ? "Biển số khớp, đã checkout."
        : "Biển số không khớp, cần xác minh thủ công.",
    });
    return;
  }

  response.status(400).json({ message: "Action không hợp lệ." });
}

export async function requestVerification(
  request: Request,
  response: Response,
) {
  const body = z
    .object({
      manualPlate: z.string().min(5).optional(),
      verificationNote: z.string().min(2),
    })
    .parse(request.body);
  const session = await ParkingSession.findById(request.params.id);
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên." });
    return;
  }

  session.manualPlate =
    body.manualPlate || session.exitDetectedPlate || session.plate;
  session.verificationNote = body.verificationNote;
  session.verificationStatus = "Chờ duyệt";
  await session.save();

  await createNotification({
    title: "Yêu cầu xác minh OCR",
    content: `Phiên ${session._id.toString()} cần admin duyệt checkout.`,
    targetRole: "admin",
  });

  response.json({ session: serializeParkingSession(session) });
}

export async function approveCheckout(request: Request, response: Response) {
  const body = z
    .object({
      manualPlate: z.string().min(5),
      verificationNote: z.string().optional(),
    })
    .parse(request.body);
  const session = await ParkingSession.findById(request.params.id);
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên." });
    return;
  }

  session.manualPlate = body.manualPlate;
  session.verificationNote = body.verificationNote || session.verificationNote;
  session.verificationStatus = "Đã duyệt";
  session.verifiedBy = objectId(request.user?.id);
  session.verifiedAt = new Date();
  session.matchStatus = "Khớp";
  await finalizeCheckout(session);
  await session.save();

  response.json({
    session: serializeParkingSession(session),
    message: "Admin đã duyệt checkout.",
  });
}

export async function cameraEntry(request: Request, response: Response) {
  const body = z
    .object({
      deviceId: z.string().min(1),
      email: z.string().email().optional(),
    })
    .parse(request.body);
  const device = await Device.findById(body.deviceId);
  if (!device || device.gate !== "entry") {
    response.status(404).json({ message: "Không tìm thấy camera cổng vào." });
    return;
  }

  const snapshot = await captureDeviceSnapshot(device);
  device.status = "online";
  device.lastSnapshotUrl = snapshot.imageUrl;
  device.lastSnapshotAt = new Date();
  await device.save();

  const detection = await detectVehicleImage(snapshotAsFile(snapshot));
  if (!detection.plate) {
    response
      .status(422)
      .json({ message: "Không nhận diện được biển số từ camera." });
    return;
  }

  const isSubscriber = await isSubscriberByPlate(detection.plate);
  const quotaAccess = await classifyVehicleByPlate(detection.plate);
  const slotDoc = await allocateSlot("Ô tô", undefined, { isSubscriber: quotaAccess.customerType === "member", quotaType: quotaAccess.quotaType });
  if (!slotDoc) {
    response.status(409).json({ message: "Bãi xe đã hết chỗ trống." });
    return;
  }

  const ownerUserId = await ownerFromPlate(detection.plate);
  const plateCheck = await checkSubscriptionDiscountForPlate(
    ownerUserId,
    detection.plate,
  );
  const isMember = quotaAccess.customerType === "member";
  const { name: ownerName, email: ownerEmail } = await getOwnerInfoFromPlate(
    detection.plate,
    body.email,
  );
  if (plateCheck.warn) {
    await createNotification({
      title: "Biển số không thuộc gói thành viên",
      content: `Biển số ${detection.plate} vào bãi nhưng KHÔNG thuộc danh sách đăng ký của user. Đã tính phí khách vãng lai.`,
      targetRole: "staff",
    });
  }

  const session = await ParkingSession.create({
    plate: detection.plate,
    ownerName,
    ownerEmail,
    vehicleType: "Ô tô",
    slot: slotDoc.slotCode,
    slotId: slotDoc._id,
      customerType: quotaAccess.customerType,
      quotaType: quotaAccess.quotaType,
    entryImageUrl: snapshot.imageUrl,
    entryDetectedPlate: detection.plate,
    entryConfidence: detection.confidence,
    entryImageHash: detection.imageHash,
    aiRawText: detection.rawText,
    ownerUserId,
    createdBy: request.user?.id,
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

  response.status(201).json({
    session: serializeParkingSession(session),
    detection,
    isMember,
    ...(plateCheck.warn ? { subscriptionWarn: plateCheck.warn } : {}),
  });
}

export async function cameraExit(request: Request, response: Response) {
  const body = z
    .object({ deviceId: z.string().min(1), sessionId: z.string().min(1) })
    .parse(request.body);
  const [device, session] = await Promise.all([
    Device.findById(body.deviceId),
    ParkingSession.findById(body.sessionId),
  ]);
  if (!device || device.gate !== "exit") {
    response.status(404).json({ message: "Không tìm thấy camera cổng ra." });
    return;
  }
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên đỗ xe." });
    return;
  }

  const snapshot = await captureDeviceSnapshot(device);
  device.status = "online";
  device.lastSnapshotUrl = snapshot.imageUrl;
  device.lastSnapshotAt = new Date();
  await device.save();

  const detection = await detectVehicleImage(snapshotAsFile(snapshot));
  if (!detection.plate) {
    response
      .status(422)
      .json({ message: "Không nhận diện được biển số từ camera." });
    return;
  }

  const matched = platesMatch(
    session.entryDetectedPlate || session.plate,
    detection.plate,
  );
  session.exitImageUrl = snapshot.imageUrl;
  session.exitDetectedPlate = detection.plate;
  session.exitConfidence = detection.confidence;
  session.exitImageHash = detection.imageHash;
  session.vehicleMatchScore = imageHashSimilarity(
    session.entryImageHash,
    detection.imageHash,
  );
  session.matchStatus = matched ? "Khớp" : "Không khớp";
  session.verificationStatus = matched ? "Không cần" : "Chờ duyệt";

  if (matched) {
    await finalizeCheckout(session);
  }

  await session.save();
  response.json({
    session: serializeParkingSession(session),
    detection,
    matched,
    message: matched
      ? "Camera checkout thành công."
      : "Camera checkout không khớp, cần admin duyệt.",
  });
}

// --- PM-05: Overdue scan + ST-13: Penalty waiver ---
import {
  scanAndFlagOverdueSessions,
  waivePenalty,
} from "../services/overdue.service.js";

export async function scanOverdueHandler(
  _request: Request,
  response: Response,
) {
  const flagged = await scanAndFlagOverdueSessions();
  response.json({
    flagged,
    message: `${flagged} phiên đã được đánh dấu quá hạn.`,
  });
}

export async function waivePenaltyHandler(
  request: Request,
  response: Response,
) {
  const body = z.object({ reason: z.string().min(2) }).parse(request.body);
  await waivePenalty(String(request.params.id), request.user!.id, body.reason);
  response.json({ ok: true, message: "Đã miễn phạt cho phiên này." });
}

// --- PM-07: Per-session receipt ---
import {
  generateReceiptPdf,
  getReceiptData,
} from "../services/receipt.service.js";

export async function getSessionReceiptHandler(
  request: Request,
  response: Response,
) {
  const data = await getReceiptData(String(request.params.id));
  response.json({ receipt: data });
}

export async function downloadSessionReceiptHandler(
  request: Request,
  response: Response,
) {
  const buffer = await generateReceiptPdf(String(request.params.id));
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="receipt-${request.params.id}.pdf"`,
  );
  response.end(buffer);
}

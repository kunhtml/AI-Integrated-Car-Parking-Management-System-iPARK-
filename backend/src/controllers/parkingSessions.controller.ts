import { Request, Response } from "express";
import { z } from "zod";
import { parkingConfig } from "../config/parking.js";
import { Device } from "../models/Device.js";
import { ParkingSlot } from "../models/ParkingSlot.js";
import { ParkingSession, ParkingSessionDocument } from "../models/ParkingSession.js";
import { RfidCard } from "../models/RfidCard.js";
import { Vehicle } from "../models/Vehicle.js";
import { detectVehicleImage, saveUploadedImage } from "../services/ai.service.js";
import { captureDeviceSnapshot } from "../services/device.service.js";
import { createNotification } from "../services/notification.service.js";
import { imageHashSimilarity, platesMatch } from "../services/plate.service.js";
import { allocateSlot, freeSlot, occupySlot } from "../services/parkingSlot.service.js";
import { calculateParkingFee, getActivePricingConfigForZone } from "../services/pricing.service.js";
import { checkSubscriptionDiscountForPlate, findActiveSubscriptionByPlate, getOwnerInfoFromPlate } from "../services/subscription.service.js";
import { createPendingTransactionForSession, objectId } from "../services/transaction.service.js";
import { Transaction, TransactionDocument } from "../models/Transaction.js";
import { saveUploadedImage } from "../services/upload.service.js";
import { serializeParkingSession } from "../utils/serializers.js";

async function finalizeCheckout(session: ParkingSessionDocument) {
  session.status = "Đã hoàn thành";
  session.checkOutAt = new Date();

  // Đã trả đủ trước đó (prepaid) → chỉ hoàn tất + nhả slot, KHÔNG tính lại phí.
  if (session.paymentStatus === "fully_paid") {
    await freeSlot(session.slotId);
    return session;
  }

  // Look up zone via slot for zone-specific pricing
  const slotDoc = session.slotId ? await ParkingSlot.findById(session.slotId) : null;
  const pricing = await getActivePricingConfigForZone(slotDoc?.zoneId);
  const feeBreakdown = calculateParkingFee(session.checkInAt, session.checkOutAt, pricing);
  session.fee = feeBreakdown.totalFee;
  session.feeBreakdown = feeBreakdown;

  // PM-05: Add overdue fine if applicable
  if (session.isOverstayed && session.overdueMinutes && session.overdueMinutes > 0) {
    const { calculateOverdueFine } = await import("../services/overdue.service.js");
    const overdueResult = calculateOverdueFine(session.checkInAt, session.checkOutAt!, {
      gracePeriod: (pricing as any).gracePeriod ?? 0,
    });
    if (overdueResult.fineAmount > 0) {
      session.fee += overdueResult.fineAmount;
      (session.feeBreakdown as any).overdueFine = overdueResult.fineAmount;
    }
  }

  // Apply subscription discount if available (đã check biển số thuộc gói)
  const subResult = await checkSubscriptionDiscountForPlate(session.ownerUserId, session.plate);
  if (subResult.discount > 0 || subResult.warn) {
    const breakdown = (session.feeBreakdown ?? ({} as any)) as Record<string, unknown>;
    if (subResult.discount > 0) {
      session.fee = Math.round(session.fee * (1 - subResult.discount / 100));
      breakdown.subscriptionDiscount = subResult.discount;
    }
    if (subResult.warn) {
      breakdown.subscriptionWarn = subResult.warn;
    }
    session.feeBreakdown = breakdown as any;
  }

  // Cộng vé phạt đang chờ của phiên này vào phí (khách vãng lai trả gộp khi ra).
  // Làm SAU khi đã tính phí gửi + giảm giá để phần phạt không bị ghi đè/giảm.
  const { Penalty } = await import("../models/Penalty.js");
  const pendingPenalties = await Penalty.find({ sessionId: session._id, status: "pending" });
  const penaltyFine = pendingPenalties.reduce((sum, p) => sum + (p.amount || 0), 0);
  if (penaltyFine > 0) {
    session.fee += penaltyFine;
    const breakdown = (session.feeBreakdown ?? ({} as any)) as Record<string, unknown>;
    breakdown.penaltyFine = penaltyFine;
    session.feeBreakdown = breakdown as any;
  }

  await createPendingTransactionForSession(session);
  // Release the slot
  await freeSlot(session.slotId);
  return session;
}

function snapshotAsFile(snapshot: { buffer: Buffer; mimetype: string }): Express.Multer.File {
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

export async function listParkingSessions(request: Request, response: Response) {
  const criteria = request.user?.role === "customer" ? { ownerUserId: request.user.id } : {};
  const sessions = await ParkingSession.find(criteria).sort({ createdAt: -1 }).limit(100);
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

export async function createParkingSession(request: Request, response: Response) {
  const body = z
    .object({
      plate: z.string().min(5),
      vehicleType: z.literal("Ô tô").default("Ô tô"),
    })
    .parse(request.body);

  // AI-09: Duplicate plate detection
  if (await checkDuplicatePlate(body.plate)) {
    response.status(409).json({
      message: `Biển số ${body.plate} đang có phiên đỗ xe chưa checkout. Không thể tạo phiên mới.`,
    });
    return;
  }

  const isSubscriber = await isSubscriberByPlate(body.plate);
  const slotDoc = await allocateSlot("Ô tô", undefined, { isSubscriber });
  if (!slotDoc) {
    response.status(409).json({ message: "Bãi xe đã hết chỗ trống." });
    return;
  }

  const ownerUserId = await ownerFromPlate(body.plate);
  const plateCheck = await checkSubscriptionDiscountForPlate(ownerUserId, body.plate);
  const isMember = plateCheck.discount === 100;
  const { name: ownerName, email: ownerEmail } = await getOwnerInfoFromPlate(body.plate);
  if (plateCheck.warn) {
    await createNotification({
      title: "Biển số không thuộc gói thành viên",
      content: `Biển số ${body.plate} vào bãi nhưng KHÔNG thuộc danh sách đăng ký của user. Đã tính phí khách vãng lai.`,
      targetRole: "staff",
    });
  }

  const session = await ParkingSession.create({
    plate: body.plate,
    ownerName,
    ownerEmail,
    vehicleType: "Ô tô",
    slot: slotDoc.slotCode,
    slotId: slotDoc._id,
    ownerUserId,
    createdBy: request.user?.id,
    ...(isMember
      ? { paymentStatus: "fully_paid", paymentMethod: "subscription", fee: 0, paidAmount: 0 }
      : {}),
    ...(plateCheck.warn ? { feeBreakdown: { subscriptionWarn: plateCheck.warn } as any } : {}),
  });

  await occupySlot(slotDoc._id, session._id);

  response.status(201).json({
    session: serializeParkingSession(session),
    isMember,
    ...(plateCheck.warn ? { subscriptionWarn: plateCheck.warn } : {}),
  });
}

export async function completeParkingSession(request: Request, response: Response) {
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
  if (body.exitDetectedPlate) session.exitDetectedPlate = body.exitDetectedPlate.toUpperCase();
  if (typeof body.exitConfidence === "number") session.exitConfidence = body.exitConfidence;
  if (body.exitImageHash) session.exitImageHash = body.exitImageHash;
  await session.save();

  // Giải phóng thẻ RFID nếu phiên được tạo bằng thẻ
  if (session.rfidCardId) {
    const card = await RfidCard.findOne({ cardId: session.rfidCardId });
    if (card && card.status === "in-use") {
      card.status = "available";
      card.lastUsedAt = new Date();
      await card.save();
    }
    if (!session.rfidReturnedAt) {
      session.rfidReturnedAt = new Date();
      await session.save();
    }
  }

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
    await safeCreateRecognitionLog({
      action: action === "exit" ? "exit" : "entry",
      source: "upload",
      status: "failed",
      confidence: detection.confidence,
      rawText: detection.rawText,
      imageHash: detection.imageHash,
      detectionMethod: detection.detectionMethod,
      sessionId: String(request.body.sessionId || "") || undefined,
      message: "Không nhận diện được biển số từ ảnh upload.",
      createdBy: request.user?.id,
    });
    response.status(422).json({
      message: "Không nhận diện được biển số. Vui lòng upload ảnh rõ hơn hoặc xác minh thủ công.",
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
    const slotDoc = await allocateSlot("Ô tô", undefined, { isSubscriber });
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
      entryImageUrl: imageUrl,
      entryDetectedPlate: detection.plate,
      entryConfidence: detection.confidence,
      entryImageHash: detection.imageHash,
      aiRawText: detection.rawText,
      ownerUserId: memberUserId || (await ownerFromPlate(detection.plate)),
      createdBy: request.user?.id,
      ...(isMember
        ? { paymentStatus: "fully_paid", paymentMethod: "subscription", fee: 0, paidAmount: 0 }
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
    const session = await ParkingSession.findById(String(request.body.sessionId || ""));
    if (!session) {
      await safeCreateRecognitionLog({
        action: "exit",
        source: "upload",
        status: "success",
        detectedPlate: detection.plate,
        confidence: detection.confidence,
        rawText: detection.rawText,
        imageHash: detection.imageHash,
        detectionMethod: detection.detectionMethod,
        message: "OCR thành công nhưng không tìm thấy phiên đỗ xe để checkout.",
        createdBy: request.user?.id,
      });
      response.status(404).json({ message: "Không tìm thấy phiên đỗ xe." });
      return;
    }

    const matched = platesMatch(session.entryDetectedPlate || session.plate, detection.plate);
    const vehicleScore = imageHashSimilarity(session.entryImageHash, detection.imageHash);
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
    await safeCreateRecognitionLog({
      action: "exit",
      source: "upload",
      status: matched ? "success" : "mismatch",
      plate: session.plate,
      detectedPlate: detection.plate,
      confidence: detection.confidence,
      rawText: detection.rawText,
      imageHash: detection.imageHash,
      detectionMethod: detection.detectionMethod,
      imageUrl,
      vehicleType: session.vehicleType,
      sessionId: session._id,
      matched,
      matchStatus: session.matchStatus,
      vehicleMatchScore: vehicleScore,
      message: matched ? "Biển số xe ra khớp với phiên gửi." : "Biển số xe ra không khớp, cần xác minh thủ công.",
      createdBy: request.user?.id,
    });
    response.json({
      session: serializeParkingSession(session),
      detection,
      matched,
      message: matched ? "Biển số khớp, đã checkout." : "Biển số không khớp, cần xác minh thủ công.",
    });
    return;
  }

  await safeCreateRecognitionLog({
    action: "manual",
    source: "upload",
    status: "success",
    detectedPlate: detection.plate,
    confidence: detection.confidence,
    rawText: detection.rawText,
    imageHash: detection.imageHash,
    detectionMethod: detection.detectionMethod,
    message: `OCR thành công nhưng action không hợp lệ: ${action || "empty"}.`,
    createdBy: request.user?.id,
  });
  response.status(400).json({ message: "Action không hợp lệ." });
}

export async function requestVerification(request: Request, response: Response) {
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

  session.manualPlate = body.manualPlate || session.exitDetectedPlate || session.plate;
  session.verificationNote = body.verificationNote;
  session.verificationStatus = "Chờ duyệt";
  await session.save();

  await safeCreateRecognitionLog({
    action: "manual",
    source: "upload",
    status: "pending-verification",
    plate: session.plate,
    detectedPlate: session.exitDetectedPlate,
    sessionId: session._id,
    matchStatus: session.matchStatus,
    detectionMethod: "manual",
    message: "Nhân viên yêu cầu xác minh biển số thủ công, chờ admin duyệt.",
    createdBy: request.user?.id,
  });

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

  response.json({ session: serializeParkingSession(session), message: "Admin đã duyệt checkout." });
}

// UC38: Cancel session
export async function cancelParkingSession(request: Request, response: Response) {
  const body = z
    .object({
      reason: z.string().min(2, "Lý do hủy phải có ít nhất 2 ký tự."),
    })
    .parse(request.body);

  const session = await ParkingSession.findById(request.params.id);
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên." });
    return;
  }

  if (session.status !== "Đang gửi") {
    response.status(400).json({ message: "Chỉ có thể hủy phiên đang gửi." });
    return;
  }

  session.status = "Đã hủy";
  session.cancelReason = body.reason;
  session.cancelledBy = objectId(request.user?.id);
  session.cancelledAt = new Date();
  await session.save();

  // Release RFID card if applicable
  if (session.rfidCardId) {
    const card = await RfidCard.findOne({ cardId: session.rfidCardId });
    if (card && card.status === "in-use") {
      card.status = "available";
      card.lastUsedAt = new Date();
      await card.save();
    }
  }

  await safeCreateRecognitionLog({
    action: "manual",
    source: "upload",
    status: "success",
    plate: session.plate,
    sessionId: session._id,
    detectionMethod: "manual",
    message: `Phiên đã bị hủy: ${body.reason}`,
    createdBy: request.user?.id,
  });

  response.json({ session: serializeParkingSession(session), message: "Đã hủy phiên đỗ xe." });
}

// UC14: Reject verification
export async function rejectVerification(request: Request, response: Response) {
  const body = z
    .object({
      reason: z.string().min(2, "Lý do từ chối phải có ít nhất 2 ký tự."),
    })
    .parse(request.body);

  const session = await ParkingSession.findById(request.params.id);
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên." });
    return;
  }

  if (session.verificationStatus !== "Chờ duyệt") {
    response.status(400).json({ message: "Phiên không ở trạng thái chờ duyệt." });
    return;
  }

  session.verificationStatus = "Từ chối";
  session.verificationNote = body.reason;
  session.verifiedBy = objectId(request.user?.id);
  session.verifiedAt = new Date();
  await session.save();

  await safeCreateRecognitionLog({
    action: "manual",
    source: "upload",
    status: "failed",
    plate: session.plate,
    detectedPlate: session.exitDetectedPlate,
    sessionId: session._id,
    matchStatus: session.matchStatus,
    detectionMethod: "manual",
    message: `Admin từ chối xác minh: ${body.reason}`,
    createdBy: request.user?.id,
  });

  // Notify staff
  await createNotification({
    title: "Xác minh bị từ chối",
    content: `Phiên ${session._id.toString()} bị từ chối: ${body.reason}`,
    targetRole: "staff",
    relatedSessionId: session._id.toString(),
  });

  response.json({ session: serializeParkingSession(session), message: "Đã từ chối xác minh." });
}

// UC42: Check duplicate active sessions
export async function checkDuplicateSession(request: Request, response: Response) {
  const plate = String(request.query.plate || "").toUpperCase().trim();
  if (!plate || plate.length < 5) {
    response.status(400).json({ message: "Biển số không hợp lệ." });
    return;
  }

  const activeSessions = await ParkingSession.find({
    plate,
    status: "Đang gửi",
  }).limit(5);

  response.json({
    hasDuplicate: activeSessions.length > 0,
    count: activeSessions.length,
    sessions: activeSessions.map(serializeParkingSession),
  });
}

export async function cameraEntry(request: Request, response: Response) {
  const body = z.object({ deviceId: z.string().min(1), email: z.string().email().optional() }).parse(request.body);
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

  const detection = await detectVehicleImage(snapshotAsFile(snapshot), device.roi as any);
  if (!detection.plate) {
    await safeCreateRecognitionLog({
      action: "camera-entry",
      source: "camera",
      status: "failed",
      confidence: detection.confidence,
      rawText: detection.rawText,
      imageHash: detection.imageHash,
      detectionMethod: detection.detectionMethod,
      imageUrl: snapshot.imageUrl,
      deviceId: device._id,
      deviceName: device.name,
      message: "Không nhận diện được biển số từ camera cổng vào.",
      createdBy: request.user?.id,
    });
    response.status(422).json({ message: "Không nhận diện được biển số từ camera." });
    return;
  }

  const isSubscriber = await isSubscriberByPlate(body.plate);
  const slotDoc = await allocateSlot("Ô tô", undefined, { isSubscriber });
  if (!slotDoc) {
    response.status(409).json({ message: "Bãi xe đã hết chỗ trống." });
    return;
  }

  const ownerUserId = await ownerFromPlate(detection.plate);
  const plateCheck = await checkSubscriptionDiscountForPlate(ownerUserId, detection.plate);
  const isMember = plateCheck.discount === 100;
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
    entryImageUrl: snapshot.imageUrl,
    entryDetectedPlate: detection.plate,
    entryConfidence: detection.confidence,
    entryImageHash: detection.imageHash,
    aiRawText: detection.rawText,
    ownerUserId,
    createdBy: request.user?.id,
    ...(isMember
      ? { paymentStatus: "fully_paid", paymentMethod: "subscription", fee: 0, paidAmount: 0 }
      : {}),
    ...(plateCheck.warn ? { feeBreakdown: { subscriptionWarn: plateCheck.warn } as any } : {}),
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
  const body = z.object({ deviceId: z.string().min(1), sessionId: z.string().min(1) }).parse(request.body);
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

  const detection = await detectVehicleImage(snapshotAsFile(snapshot), device.roi as any);
  if (!detection.plate) {
    await safeCreateRecognitionLog({
      action: "camera-exit",
      source: "camera",
      status: "failed",
      plate: session.plate,
      confidence: detection.confidence,
      rawText: detection.rawText,
      imageHash: detection.imageHash,
      detectionMethod: detection.detectionMethod,
      imageUrl: snapshot.imageUrl,
      sessionId: session._id,
      deviceId: device._id,
      deviceName: device.name,
      message: "Không nhận diện được biển số từ camera cổng ra.",
      createdBy: request.user?.id,
    });
    response.status(422).json({ message: "Không nhận diện được biển số từ camera." });
    return;
  }

  const matched = platesMatch(session.entryDetectedPlate || session.plate, detection.plate);
  session.exitImageUrl = snapshot.imageUrl;
  session.exitDetectedPlate = detection.plate;
  session.exitConfidence = detection.confidence;
  session.exitImageHash = detection.imageHash;
  session.vehicleMatchScore = imageHashSimilarity(session.entryImageHash, detection.imageHash);
  session.matchStatus = matched ? "Khớp" : "Không khớp";
  session.verificationStatus = matched ? "Không cần" : "Chờ duyệt";

  if (matched) {
    await finalizeCheckout(session);
  }

  await session.save();
  await safeCreateRecognitionLog({
    action: "camera-exit",
    source: "camera",
    status: matched ? "success" : "mismatch",
    plate: session.plate,
    detectedPlate: detection.plate,
    confidence: detection.confidence,
    rawText: detection.rawText,
    imageHash: detection.imageHash,
    detectionMethod: detection.detectionMethod,
    imageUrl: snapshot.imageUrl,
    vehicleType: session.vehicleType,
    sessionId: session._id,
    deviceId: device._id,
    deviceName: device.name,
    matched,
    matchStatus: session.matchStatus,
    vehicleMatchScore: session.vehicleMatchScore,
    message: matched ? "Camera checkout thành công." : "Camera checkout không khớp, cần admin duyệt.",
    createdBy: request.user?.id,
  });
  response.json({
    session: serializeParkingSession(session),
    detection,
    matched,
    message: matched ? "Camera checkout thành công." : "Camera checkout không khớp, cần admin duyệt.",
  });
}

// --- PM-05: Overdue scan + ST-13: Penalty waiver ---
import { scanAndFlagOverdueSessions, waivePenalty } from "../services/overdue.service.js";

export async function scanOverdueHandler(_request: Request, response: Response) {
  const flagged = await scanAndFlagOverdueSessions();
  response.json({ flagged, message: `${flagged} phiên đã được đánh dấu quá hạn.` });
}

export async function waivePenaltyHandler(request: Request, response: Response) {
  const body = z.object({ reason: z.string().min(2) }).parse(request.body);
  await waivePenalty(String(request.params.id), request.user!.id, body.reason);
  response.json({ ok: true, message: "Đã miễn phạt cho phiên này." });
}

// --- PM-07: Per-session receipt ---
import { generateReceiptPdf, getReceiptData } from "../services/receipt.service.js";

export async function getSessionReceiptHandler(request: Request, response: Response) {
  const data = await getReceiptData(String(request.params.id));
  response.json({ receipt: data });
}

export async function downloadSessionReceiptHandler(request: Request, response: Response) {
  const buffer = await generateReceiptPdf(String(request.params.id));
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="receipt-${request.params.id}.pdf"`);
  response.end(buffer);
}

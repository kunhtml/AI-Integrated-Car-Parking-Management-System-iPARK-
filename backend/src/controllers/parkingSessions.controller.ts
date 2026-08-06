import { Request, Response } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { allocateCarSlot, parkingConfig } from "../config/parking.js";
import { Device } from "../models/Device.js";
import { ParkingSession, ParkingSessionDocument } from "../models/ParkingSession.js";
import { Vehicle } from "../models/Vehicle.js";
import { detectVehicleImage, saveUploadedImage } from "../services/ai.service.js";
import { captureDeviceSnapshot } from "../services/device.service.js";
import { createNotification } from "../services/notification.service.js";
import { imageHashSimilarity, platesMatch } from "../services/plate.service.js";
import { calculateParkingFee, getActivePricingConfig } from "../services/pricing.service.js";
import {
  checkSubscriptionDiscountForPlate,
  findActiveSubscriptionByPlate,
} from "../services/subscription.service.js";
import { createPendingTransactionForSession, objectId } from "../services/transaction.service.js";
import { serializeParkingSession } from "../utils/serializers.js";

const ACTIVE_STATUS = "Đang gửi";
const COMPLETED_STATUS = "Đã hoàn thành";
const CAR_TYPE = "Ô tô";

function normalizePlate(value = "") {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

function normalizeRfid(value?: string) {
  return value?.trim().toUpperCase() || undefined;
}

function buildGuestTicket(displayPlate: string, slot: string) {
  const token = `TICKET-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const qrExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    paymentLookupCode: token,
    qrExpiry,
    qrCode: JSON.stringify({
      provider: "payos",
      token,
      plate: displayPlate,
      slot,
      expiresAt: qrExpiry.toISOString(),
      type: "guest-parking-session",
    }),
  };
}

async function ownerFromPlate(plate: string) {
  const vehicle = await Vehicle.findOne({ plate: normalizePlate(plate) });
  return {
    ownerUserId: vehicle?.userId,
    ownerName: vehicle?.ownerName,
  };
}

async function applyActiveSubscriptionBenefit(session: ParkingSessionDocument) {
  const plate = normalizePlate(session.entryDetectedPlate || session.plate);
  if (!plate || plate.startsWith("RFID")) {
    return false;
  }

  const member = await findActiveSubscriptionByPlate(plate);
  if (!member) {
    return false;
  }

  const discount = await checkSubscriptionDiscountForPlate(member.userId, plate);
  if (discount.discount !== 100) {
    return false;
  }

  session.isMember = true;
  session.ownerUserId = objectId(member.userId) || session.ownerUserId;
  session.subscriptionId = objectId(member.subscriptionId);
  session.memberCode = member.memberCode || session.memberCode;
  session.subscriptionPlanName = member.planName;
  session.paymentStatus = "fully_paid";
  session.paymentMethod = "subscription";
  session.fee = 0;
  session.paidAmount = 0;
  session.paymentLookupCode = undefined;
  session.qrCode = undefined;
  return true;
}

async function ensureCapacity() {
  const activeCount = await ParkingSession.countDocuments({ status: ACTIVE_STATUS });
  if (activeCount >= parkingConfig.totalCapacity) {
    const err = new Error("Bãi xe đã đủ 30 chỗ.") as Error & { status: number };
    err.status = 409;
    throw err;
  }
  return activeCount;
}

async function finalizeCheckout(session: ParkingSessionDocument) {
  session.status = COMPLETED_STATUS;
  session.checkOutAt = new Date();

  const hasActiveSubscription = await applyActiveSubscriptionBenefit(session);
  if (hasActiveSubscription || session.isMember || session.paymentMethod === "subscription") {
    session.fee = 0;
    session.paidAmount = 0;
    session.paymentStatus = "fully_paid";
    session.paymentMethod = "subscription";
    return session;
  }

  const pricing = await getActivePricingConfig();
  const feeBreakdown = calculateParkingFee(session.checkInAt, session.checkOutAt, pricing);
  session.fee = feeBreakdown.totalFee;
  session.feeBreakdown = feeBreakdown;
  await createPendingTransactionForSession(session);
  return session;
}

function snapshotAsFile(snapshot: { buffer: Buffer; mimetype: string }): Express.Multer.File {
  return {
    buffer: snapshot.buffer,
    mimetype: snapshot.mimetype,
    originalname: "camera-snapshot.jpg",
  } as Express.Multer.File;
}

async function triggerMemberBarrier(session: ParkingSessionDocument) {
  if (!session.isMember) return false;
  session.barrierTriggered = true;
  session.barrierTriggeredAt = new Date();
  session.barrierAction = "open_entry";
  return true;
}

async function checkDuplicatePlate(plate?: string, rfidUid?: string) {
  const normPlate = plate ? normalizePlate(plate) : undefined;
  const normRfid = rfidUid ? normalizeRfid(rfidUid) : undefined;
  if (!normPlate && !normRfid) {
    return;
  }
  const duplicate = await ParkingSession.findOne({
    status: ACTIVE_STATUS,
    $or: [
      ...(normPlate ? [{ plate: normPlate }] : []),
      ...(normRfid ? [{ rfidUid: normRfid }] : []),
    ],
  });
  if (duplicate) {
    const displayVal = normPlate || (normRfid ? `RFID-${normRfid}` : "");
    const err = new Error(`Biển số ${displayVal} đang có phiên đỗ xe chưa checkout. Không thể tạo phiên mới.`) as Error & { status: number };
    err.status = 409;
    throw err;
  }
}

async function createEntrySession(params: {
  plate?: string;
  owner?: string;
  rfidUid?: string;
  entryImageUrl?: string;
  entryDetectedPlate?: string;
  entryConfidence?: number;
  entryImageHash?: string;
  aiRawText?: string;
  createdBy?: string;
  deviceId?: string;
}) {
  const plate = normalizePlate(params.plate);
  const rfidUid = normalizeRfid(params.rfidUid);
  if (!plate && !rfidUid) {
    const err = new Error("Thiếu biển số hoặc RFID UID.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  await checkDuplicatePlate(plate, rfidUid);

  const activeCount = await ensureCapacity();
  const ownerInfo = (plate ? await ownerFromPlate(plate) : {}) as any;
  const member = plate ? await findActiveSubscriptionByPlate(plate) : null;
  const discount = member
    ? await checkSubscriptionDiscountForPlate(member.userId, plate)
    : { discount: 0 };
  const isMember = Boolean(member && discount.discount === 100);
  const displayPlate = plate || `RFID-${rfidUid}`;
  const slot = allocateCarSlot(activeCount);
  const guestTicket = isMember ? undefined : buildGuestTicket(displayPlate, slot);

  const session = await ParkingSession.create({
    plate: displayPlate,
    rfidUid,
    ownerName: params.owner?.trim() || ownerInfo.ownerName || (isMember ? "Thành viên iPARK" : "Khách vãng lai"),
    vehicleType: CAR_TYPE,
    slot,
    ownerUserId: objectId(member?.userId) || ownerInfo.ownerUserId,
    isMember,
    subscriptionId: objectId(member?.subscriptionId),
    memberCode: member?.memberCode || undefined,
    subscriptionPlanName: member?.planName,
    paymentStatus: isMember ? "fully_paid" : "unpaid",
    paymentMethod: isMember ? "subscription" : undefined,
    fee: 0,
    paidAmount: 0,
    paymentLookupCode: guestTicket?.paymentLookupCode,
    qrCode: guestTicket?.qrCode,
    qrExpiry: guestTicket?.qrExpiry,
    entryImageUrl: params.entryImageUrl,
    entryDetectedPlate: params.entryDetectedPlate || plate,
    entryConfidence: params.entryConfidence,
    entryImageHash: params.entryImageHash,
    aiRawText: params.aiRawText,
    createdBy: objectId(params.createdBy),
  });

  await triggerMemberBarrier(session);
  if (session.isModified()) {
    await session.save();
  }

  // Open barrier for the corresponding entry device automatically if it's a member or an RFID card is assigned
  const entryDevice = params.deviceId
    ? await Device.findById(params.deviceId)
    : await Device.findOne({ gate: "entry" });

  const shouldOpenBarrier = isMember || Boolean(rfidUid);

  if (shouldOpenBarrier && entryDevice) {
    entryDevice.barrierStatus = "open";
    await entryDevice.save();
  }

  return {
    session,
    member,
    message: isMember
      ? "Đã tạo phiên thành viên. Gói active được áp dụng, phí = 0."
      : "Đã tạo phiên khách vãng lai. Phiên đang chờ thanh toán khi xe ra.",
  };
}

export async function listParkingSessions(request: Request, response: Response) {
  const criteria = request.user?.role === "customer" ? { ownerUserId: request.user.id } : {};
  const sessions = await ParkingSession.find(criteria).sort({ createdAt: -1 }).limit(100);
  response.json({ sessions: sessions.map(serializeParkingSession) });
}

export async function createParkingSession(request: Request, response: Response) {
  const body = z
    .object({
      plate: z.string().optional(),
      rfidUid: z.string().optional(),
      owner: z.string().optional(),
      vehicleType: z.string().optional(),
    })
    .refine((value) => Boolean(value.plate?.trim() || value.rfidUid?.trim()), {
      message: "Cần nhập biển số hoặc RFID UID.",
      path: ["plate"],
    })
    .parse(request.body);

  const result = await createEntrySession({
    plate: body.plate,
    rfidUid: body.rfidUid,
    owner: body.owner,
    createdBy: request.user?.id,
  });

  response.status(201).json({
    session: serializeParkingSession(result.session),
    member: result.member,
    message: result.message,
  });
}

export async function completeParkingSession(request: Request, response: Response) {
  const body = z.object({ id: z.string().min(1) }).parse(request.body);
  const session = await ParkingSession.findById(body.id);
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên." });
    return;
  }

  await finalizeCheckout(session);
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
      message: "Không nhận diện được biển số. Vui lòng upload ảnh rõ hơn hoặc xác minh thủ công.",
    });
    return;
  }

  if (action === "entry") {
    const imageUrl = await saveUploadedImage(image, "entry");
    const result = await createEntrySession({
      plate: detection.plate,
      owner: String(request.body.owner || ""),
      rfidUid: String(request.body.rfidUid || ""),
      entryImageUrl: imageUrl,
      entryDetectedPlate: detection.plate,
      entryConfidence: detection.confidence,
      entryImageHash: detection.imageHash,
      aiRawText: detection.rawText,
      createdBy: request.user?.id,
    });

    response.status(201).json({
      session: serializeParkingSession(result.session),
      detection,
      member: result.member,
      message: result.message,
    });
    return;
  }

  if (action === "exit") {
    const session = await ParkingSession.findById(String(request.body.sessionId || ""));
    if (!session) {
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
    response.json({
      session: serializeParkingSession(session),
      detection,
      matched,
      message: matched ? "Biển số khớp, đã checkout." : "Biển số không khớp, cần xác minh thủ công.",
    });
    return;
  }

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

export async function cameraEntry(request: Request, response: Response) {
  const body = z.object({ deviceId: z.string().min(1), owner: z.string().optional() }).parse(request.body);
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
    response.status(422).json({ message: "Không nhận diện được biển số từ camera." });
    return;
  }

  const result = await createEntrySession({
    plate: detection.plate,
    owner: body.owner,
    entryImageUrl: snapshot.imageUrl,
    entryDetectedPlate: detection.plate,
    entryConfidence: detection.confidence,
    entryImageHash: detection.imageHash,
    aiRawText: detection.rawText,
    createdBy: request.user?.id,
    deviceId: body.deviceId,
  });

  response.status(201).json({
    session: serializeParkingSession(result.session),
    detection,
    member: result.member,
    message: result.message,
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

  const detection = await detectVehicleImage(snapshotAsFile(snapshot));
  if (!detection.plate) {
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
  response.json({
    session: serializeParkingSession(session),
    detection,
    matched,
    message: matched ? "Camera checkout thành công." : "Camera checkout không khớp, cần admin duyệt.",
  });
}

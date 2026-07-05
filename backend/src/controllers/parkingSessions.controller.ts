import { Request, Response } from "express";
import { z } from "zod";
import { allocateCarSlot, canEnterParking, parkingConfig } from "../config/parking.js";
import { Device } from "../models/Device.js";
import { ParkingSession, ParkingSessionDocument } from "../models/ParkingSession.js";
import { Vehicle } from "../models/Vehicle.js";
import { detectVehicleImage, saveUploadedImage } from "../services/ai.service.js";
import { captureDeviceSnapshot } from "../services/device.service.js";
import { createNotification } from "../services/notification.service.js";
import { imageHashSimilarity, platesMatch } from "../services/plate.service.js";
import { calculateParkingFee, getActivePricingConfig } from "../services/pricing.service.js";
import { safeCreateRecognitionLog } from "../services/recognitionLog.service.js";
import { createPendingTransactionForSession, objectId } from "../services/transaction.service.js";
import { serializeParkingSession } from "../utils/serializers.js";

async function finalizeCheckout(session: ParkingSessionDocument) {
  session.status = "Đã hoàn thành";
  session.checkOutAt = new Date();
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

async function ownerFromPlate(plate: string) {
  const vehicle = await Vehicle.findOne({ plate: plate.toUpperCase() });
  return vehicle?.userId;
}

export async function listParkingSessions(request: Request, response: Response) {
  const criteria = request.user?.role === "customer" ? { ownerUserId: request.user.id } : {};
  const sessions = await ParkingSession.find(criteria).sort({ createdAt: -1 }).limit(100);
  response.json({ sessions: sessions.map(serializeParkingSession) });
}

export async function createParkingSession(request: Request, response: Response) {
  const body = z
    .object({
      plate: z.string().min(5),
      owner: z.string().min(2),
      vehicleType: z.literal("Ô tô").default("Ô tô"),
    })
    .parse(request.body);

  const activeCount = await ParkingSession.countDocuments({ status: "Đang gửi" });
  const isMember = !!(await ownerFromPlate(body.plate)); // Có ownerUserId = thành viên
  const check = await canEnterParking(isMember, activeCount);

  if (!check.allowed) {
    response.status(409).json({
      message: check.reason || "Bãi xe đã đầy.",
      remaining: parkingConfig.totalCapacity - activeCount,
      isMemberOnly: check.mode === "dynamic" && !isMember,
    });
    return;
  }

  const session = await ParkingSession.create({
    plate: body.plate,
    ownerName: body.owner,
    vehicleType: "Ô tô",
    slot: allocateCarSlot(activeCount),
    ownerUserId: await ownerFromPlate(body.plate),
    createdBy: objectId(request.user?.id),
    // Thêm trường để track membership priority (sẽ update model sau)
    priorityType: isMember ? "member" : "walkin",
  });

  response.status(201).json({ session: serializeParkingSession(session) });
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
    await safeCreateRecognitionLog({
      action: action === "exit" ? "exit" : "entry",
      source: "upload",
      status: "failed",
      confidence: detection.confidence,
      rawText: detection.rawText,
      imageHash: detection.imageHash,
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
    const activeCount = await ParkingSession.countDocuments({ status: "Đang gửi" });
    const isMember = !!(await ownerFromPlate(detection.plate));
    const check = await canEnterParking(isMember, activeCount);

    if (!check.allowed) {
      await safeCreateRecognitionLog({
        action: "entry",
        source: "upload",
        status: "success",
        detectedPlate: detection.plate,
        confidence: detection.confidence,
        rawText: detection.rawText,
        imageHash: detection.imageHash,
        message: check.reason || "OCR thành công nhưng bãi xe không cho phép xe vào.",
        createdBy: request.user?.id,
      });
      response.status(409).json({
        message: check.reason || "Bãi xe đã đầy.",
        remaining: parkingConfig.totalCapacity - activeCount,
        isMemberOnly: check.mode === "dynamic" && !isMember,
      });
      return;
    }

    const imageUrl = await saveUploadedImage(image, "entry");
    const session = await ParkingSession.create({
      plate: detection.plate,
      ownerName: String(request.body.owner || "Khách vãng lai"),
      vehicleType: "Ô tô",
      slot: allocateCarSlot(activeCount),
      entryImageUrl: imageUrl,
      entryDetectedPlate: detection.plate,
      entryConfidence: detection.confidence,
      entryImageHash: detection.imageHash,
      aiRawText: detection.rawText,
      ownerUserId: await ownerFromPlate(detection.plate),
      createdBy: objectId(request.user?.id),
      priorityType: isMember ? "member" : "walkin",
    });

    await safeCreateRecognitionLog({
      action: "entry",
      source: "upload",
      status: "success",
      plate: session.plate,
      detectedPlate: detection.plate,
      confidence: detection.confidence,
      rawText: detection.rawText,
      imageHash: detection.imageHash,
      imageUrl,
      vehicleType: session.vehicleType,
      sessionId: session._id,
      matched: true,
      matchStatus: session.matchStatus,
      message: "Đã nhận diện biển số xe vào từ ảnh upload.",
      createdBy: request.user?.id,
    });

    response.status(201).json({ session: serializeParkingSession(session), detection });
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
    await safeCreateRecognitionLog({
      action: "camera-entry",
      source: "camera",
      status: "failed",
      confidence: detection.confidence,
      rawText: detection.rawText,
      imageHash: detection.imageHash,
      imageUrl: snapshot.imageUrl,
      deviceId: device._id,
      deviceName: device.name,
      message: "Không nhận diện được biển số từ camera cổng vào.",
      createdBy: request.user?.id,
    });
    response.status(422).json({ message: "Không nhận diện được biển số từ camera." });
    return;
  }

  const activeCount = await ParkingSession.countDocuments({ status: "Đang gửi" });
  if (activeCount >= parkingConfig.totalCapacity) {
    await safeCreateRecognitionLog({
      action: "camera-entry",
      source: "camera",
      status: "success",
      detectedPlate: detection.plate,
      confidence: detection.confidence,
      rawText: detection.rawText,
      imageHash: detection.imageHash,
      imageUrl: snapshot.imageUrl,
      deviceId: device._id,
      deviceName: device.name,
      message: "OCR thành công nhưng bãi xe đã đủ 30 chỗ.",
      createdBy: request.user?.id,
    });
    response.status(409).json({ message: "Bãi xe đã đủ 30 chỗ." });
    return;
  }

  const session = await ParkingSession.create({
    plate: detection.plate,
    ownerName: body.owner || "Khách vãng lai",
    vehicleType: "Ô tô",
    slot: allocateCarSlot(activeCount),
    entryImageUrl: snapshot.imageUrl,
    entryDetectedPlate: detection.plate,
    entryConfidence: detection.confidence,
    entryImageHash: detection.imageHash,
    aiRawText: detection.rawText,
    ownerUserId: await ownerFromPlate(detection.plate),
    createdBy: objectId(request.user?.id),
  });

  await safeCreateRecognitionLog({
    action: "camera-entry",
    source: "camera",
    status: "success",
    plate: session.plate,
    detectedPlate: detection.plate,
    confidence: detection.confidence,
    rawText: detection.rawText,
    imageHash: detection.imageHash,
    imageUrl: snapshot.imageUrl,
    vehicleType: session.vehicleType,
    sessionId: session._id,
    deviceId: device._id,
    deviceName: device.name,
    matched: true,
    matchStatus: session.matchStatus,
    message: "Đã nhận diện biển số xe vào từ camera.",
    createdBy: request.user?.id,
  });

  response.status(201).json({ session: serializeParkingSession(session), detection });
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
    await safeCreateRecognitionLog({
      action: "camera-exit",
      source: "camera",
      status: "failed",
      plate: session.plate,
      confidence: detection.confidence,
      rawText: detection.rawText,
      imageHash: detection.imageHash,
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

import mongoose from "mongoose";
import { RfidCard, type RfidCardDocument } from "../models/RfidCard.js";
import { RfidScanLog } from "../models/RfidScanLog.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { AppError } from "../utils/AppError.js";
import { allocateSlot, occupySlot } from "./parkingSlot.service.js";
import { classifyVehicleByPlate } from "./parkingQuota.service.js";
import { findActiveSubscriptionByPlate } from "./subscription.service.js";

/**
 * RFID Guest là thẻ dùng chung theo lượt. Khi xe ra, mọi liên kết phương tiện
 * trên thẻ phải được xóa; lịch sử luôn được giữ ở ParkingSession/RfidScanLog.
 */
function releaseGuestCard(card: RfidCardDocument, returnedAt: Date) {
  card.status = "available";
  card.returnedAt = returnedAt;
  card.lastUsedAt = returnedAt;
  card.plate = "";
  card.ownerName = "Guest";
  card.userId = undefined;
  card.vehicleId = undefined;
}

// ───────────────── Card CRUD ─────────────────

export async function registerCard(cardId: string, notes?: string, createdBy?: string) {
  const existing = await RfidCard.findOne({ cardId: cardId.toUpperCase() });
  if (existing) {
    throw new AppError("Thẻ RFID này đã tồn tại.", 409);
  }
  const card = await RfidCard.create({
    cardId: cardId.toUpperCase(),
    notes,
    createdBy: createdBy ? new mongoose.Types.ObjectId(createdBy) : undefined,
  });
  return card;
}

export async function listCards(options: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (options.status) {
    filter.status = options.status;
  }
  if (options.search) {
    filter.cardId = { $regex: options.search.toUpperCase(), $options: "i" };
  }

  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const skip = (page - 1) * limit;

  const [cards, total] = await Promise.all([
    RfidCard.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    RfidCard.countDocuments(filter),
  ]);

  return { cards, total, page, limit };
}

export async function getCardDetail(id: string) {
  const card = await RfidCard.findById(id).populate("createdBy", "name email");
  if (!card) {
    throw new AppError("Không tìm thấy thẻ RFID.", 404);
  }

  // Get current active session using this card
  const activeSession = await ParkingSession.findOne({
    rfidCardId: card.cardId,
    status: "Đang gửi",
  });

  // Get scan log count
  const scanCount = await RfidScanLog.countDocuments({ cardId: card.cardId });

  return { card, activeSession, scanCount };
}

export async function updateCardStatus(
  id: string,
  status: "available" | "in-use" | "lost" | "blocked",
  blockedReason?: string,
  notes?: string,
) {
  const card = await RfidCard.findById(id);
  if (!card) {
    throw new AppError("Không tìm thấy thẻ RFID.", 404);
  }

  card.status = status;
  if (status === "lost") {
    card.lostAt = new Date();
  }
  if (status === "blocked") {
    card.blockedAt = new Date();
    if (blockedReason) card.blockedReason = blockedReason;
  }
  if (notes) card.notes = notes;
  await card.save();

  return card;
}

// ───────────────── Scan & Assign Logic ─────────────────

export async function validateEntry(
  cardId: string,
  gate: string,
  performedBy?: string,
  deviceId?: string,
  plateDetected?: string,
) {
  const card = await RfidCard.findOne({ cardId: cardId.toUpperCase() });
  if (!card) {
    await logScan({ cardId, action: "entry", status: "failed", failureReason: "Thẻ không tồn tại", performedBy, deviceId });
    throw new AppError("Thẻ RFID không tồn tại.", 404);
  }

  const blockedEntryStatuses = ["inactive", "pending-sale", "lost", "blocked", "damaged", "returned"];
  if (blockedEntryStatuses.includes(card.status)) {
    const reason = card.status === "blocked" ? (card.blockedReason || "Thẻ đã bị khóa") : card.status === "lost" ? "Thẻ đã bị báo mất" : card.status === "damaged" ? "Thẻ đã được ghi nhận hỏng" : card.status === "pending-sale" ? "Thẻ đang chờ hoàn tất giao dịch bán" : "Thẻ RFID chưa sẵn sàng sử dụng";
    await logScan({ cardId, action: "entry", status: "blocked", failureReason: reason, performedBy, deviceId });
    throw new AppError(reason, 403);
  }
  // Thẻ cũ chưa có cardType được tương thích như RFID Guest tạm thời.
  const canIssueGuestCard = card.cardType !== "member" && card.status === "available";
  if (!canIssueGuestCard && !["active", "in-use"].includes(card.status)) {
    await logScan({ cardId, action: "entry", status: "failed", failureReason: "Thẻ chưa được kích hoạt hoặc cấp tại cổng", performedBy, deviceId });
    throw new AppError("Thẻ RFID chưa được kích hoạt hoặc chưa sẵn sàng cấp tại cổng.", 403);
  }

  // Anti-passback: check if card already has an active session
  const activeSession = await ParkingSession.findOne({
    rfidCardId: cardId.toUpperCase(),
    status: "Đang gửi",
  });
  if (activeSession) {
    await logScan({ cardId, action: "entry", status: "failed", failureReason: "Thẻ đang có phiên gửi xe chưa checkout", performedBy, deviceId });
    throw new AppError("Thẻ này đang có phiên gửi xe chưa checkout. Không thể vào lại.", 409);
  }

  const normalizedPlate = plateDetected?.trim().toUpperCase();
  const isMemberCard = card.cardType === "member";
  const memberPlate = card.plate?.trim().toUpperCase() || "";

  // Tự chữa dữ liệu cũ của RFID Guest nếu phiên trước chưa làm sạch đầy đủ.
  // Biển của phiên hiện tại được lưu trên ParkingSession, không lưu trên thẻ.
  if (!isMemberCard && (card.plate || card.userId || card.vehicleId)) {
    card.plate = "";
    card.ownerName = "Guest";
    card.userId = undefined;
    card.vehicleId = undefined;
    await card.save();
  }

  let quotaAccess: { customerType: "member" | "guest"; quotaType: "member" | "walk_in"; userId?: string };
  if (isMemberCard) {
    if (!card.userId || !card.vehicleId || !memberPlate) {
      throw new AppError("RFID Member chưa được liên kết đầy đủ với xe và tài khoản.", 409);
    }
    if (normalizedPlate && normalizedPlate !== memberPlate) {
      throw new AppError("Biển số nhận diện không khớp với xe gắn trên RFID Member.", 409);
    }
    const activeSubscription = await findActiveSubscriptionByPlate(memberPlate);
    if (!activeSubscription || activeSubscription.primaryVehicleId !== card.vehicleId.toString()) {
      throw new AppError("RFID Member chưa có gói còn hiệu lực cho xe này.", 403);
    }
    quotaAccess = { customerType: "member", quotaType: "member", userId: card.userId.toString() };
  } else {
    // Thẻ Guest không được hưởng quota Member ngay cả khi camera đọc trúng biển đã đăng ký.
    quotaAccess = { customerType: "guest", quotaType: "walk_in", userId: undefined };
  }
  const slotDoc = await allocateSlot("Ô tô", undefined, { quotaType: quotaAccess.quotaType });
  if (!slotDoc) {
    await logScan({ cardId, action: "entry", status: "failed", failureReason: "Không còn slot phù hợp với quota", performedBy, deviceId });
    throw new AppError("Bãi xe đã hết slot phù hợp.", 409);
  }

  // Tự động tạo phiên gửi xe và gán thẻ
  const session = await ParkingSession.create({
    plate: isMemberCard ? memberPlate : (normalizedPlate || cardId.toUpperCase()),
    ownerName: isMemberCard ? card.ownerName : "Khách vãng lai (RFID)",
    vehicleType: "Ô tô",
     slot: slotDoc.slotCode,
     slotId: slotDoc._id,
     customerType: quotaAccess.customerType,
     quotaType: quotaAccess.quotaType,
    rfidCardId: cardId.toUpperCase(),
    rfidAssignedAt: new Date(),
    rfidGate: "entry",
    entryDetectedPlate: plateDetected ? plateDetected.toUpperCase() : undefined,
    ...(isMemberCard ? { ownerUserId: card.userId, vehicleId: card.vehicleId } : {}),
    createdBy: performedBy ? new mongoose.Types.ObjectId(performedBy) : undefined,
    ...(quotaAccess.customerType === "member"
      ? { paymentStatus: "fully_paid", paymentMethod: "subscription", fee: 0, paidAmount: 0 }
      : {}),
  });

  await occupySlot(slotDoc._id, session._id);

  card.status = "in-use";
  card.lastUsedAt = new Date();
  await card.save();

  await logScan({
    cardId,
    action: "entry",
    sessionId: session._id.toString(),
    status: "success",
    performedBy,
    deviceId,
    plateDetected,
  });

  return { card, session, message: "Đã tạo phiên gửi xe và gán thẻ thành công." };
}

export async function validateExit(
  cardId: string,
  gate: string,
  performedBy?: string,
  deviceId?: string,
  plateDetected?: string,
) {
  const card = await RfidCard.findOne({ cardId: cardId.toUpperCase() });
  if (!card) {
    await logScan({ cardId, action: "exit", status: "failed", failureReason: "Thẻ không tồn tại", performedBy, deviceId });
    throw new AppError("Thẻ RFID không tồn tại.", 404);
  }

  const blockedExitStatuses = ["inactive", "pending-sale", "lost", "blocked", "damaged", "returned"];
  if (blockedExitStatuses.includes(card.status)) {
    await logScan({ cardId, action: "exit", status: "blocked", failureReason: card.status === "blocked" ? (card.blockedReason || "Thẻ đã bị khóa") : card.status === "lost" ? "Thẻ đã bị báo mất" : "Thẻ RFID không ở trạng thái hợp lệ", performedBy, deviceId });
    throw new AppError("Thẻ RFID không hợp lệ để ra.", 403);
  }
  if (!["active", "in-use"].includes(card.status)) {
    await logScan({ cardId, action: "exit", status: "failed", failureReason: "Thẻ chưa được bán hoặc kích hoạt", performedBy, deviceId });
    throw new AppError("Thẻ RFID chưa được bán hoặc kích hoạt.", 403);
  }

  const activeSession = await ParkingSession.findOne({
    rfidCardId: cardId.toUpperCase(),
    status: "Đang gửi",
  });
  if (!activeSession) {
    await logScan({ cardId, action: "exit", status: "failed", failureReason: "Không tìm thấy phiên gửi xe đang hoạt động", performedBy, deviceId });
    throw new AppError("Không tìm thấy phiên gửi xe đang hoạt động cho thẻ này.", 404);
  }

  // Cross-check plate if detected
  let mismatch = false;
  if (plateDetected) {
    const detected = plateDetected.toUpperCase();
    // Chỉ báo mismatch khi phiên đã có biển số thật (không phải placeholder cardId)
    if (activeSession.plate && activeSession.plate !== cardId.toUpperCase()) {
      mismatch = detected !== activeSession.plate;
    }
    // Cập nhật biển số phiên bằng biển số vừa quét ra (đã biết)
    activeSession.plate = detected;
  }

  if (mismatch) {
    await logScan({
      cardId,
      action: "exit",
      sessionId: activeSession._id.toString(),
      status: "mismatch",
      failureReason: "Biển số không khớp với lúc vào",
      performedBy,
      deviceId,
      plateDetected,
    });
    return { card, session: activeSession, mismatch: true };
  }

  // Guest trả thẻ và thanh toán theo lượt; Member hoàn tất phiên nhưng vẫn sở hữu thẻ.
  activeSession.status = "Đã hoàn thành";
  activeSession.checkOutAt = new Date();
  if (card.cardType !== "member") {
    const { getActivePricingConfig } = await import("../services/pricing.service.js");
    const { calculateParkingFee } = await import("../services/pricing.service.js");
    const { createPendingTransactionForSession } = await import("./transaction.service.js");
    const pricing = await getActivePricingConfig();
    const feeBreakdown = calculateParkingFee(activeSession.checkInAt, activeSession.checkOutAt, pricing);
    activeSession.fee = feeBreakdown.totalFee;
    activeSession.feeBreakdown = feeBreakdown;
    const returnedAt = new Date();
    activeSession.rfidReturnedAt = returnedAt;
    await activeSession.save();
    await createPendingTransactionForSession(activeSession);
    releaseGuestCard(card, returnedAt);
  } else {
    activeSession.fee = 0;
    activeSession.paidAmount = 0;
    activeSession.paymentStatus = "fully_paid";
    activeSession.paymentMethod = "subscription";
    await activeSession.save();
    card.status = "active";
  }
  card.lastUsedAt = new Date();
  await card.save();

  await logScan({
    cardId,
    action: "exit",
    sessionId: activeSession._id.toString(),
    status: "success",
    performedBy,
    deviceId,
    plateDetected,
  });

  return { card, session: activeSession, mismatch: false };
}

export async function confirmExitWithMismatch(
  cardId: string,
  sessionId: string,
  action: "confirm" | "reject",
  performedBy?: string,
) {
  const card = await RfidCard.findOne({ cardId: cardId.toUpperCase() });
  if (!card) {
    throw new AppError("Thẻ RFID không tồn tại.", 404);
  }

  const session = await ParkingSession.findById(sessionId);
  if (!session) {
    throw new AppError("Không tìm thấy phiên gửi xe.", 404);
  }

  if (session.status !== "Đang gửi") {
    throw new AppError("Phiên gửi xe không còn ở trạng thái đang gửi.", 400);
  }

  if (action === "reject") {
    await logScan({
      cardId,
      action: "exit",
      sessionId,
      status: "mismatch",
      failureReason: "Nhân viên từ chối do biển số không khớp",
      performedBy,
    });
    return { card, session, confirmed: false };
  }

  // action === "confirm" → Guest trả thẻ; Member hoàn tất phiên nhưng giữ thẻ.
  session.status = "Đã hoàn thành";
  session.checkOutAt = new Date();
  if (card.cardType !== "member") {
    const { getActivePricingConfig } = await import("../services/pricing.service.js");
    const { calculateParkingFee } = await import("../services/pricing.service.js");
    const { createPendingTransactionForSession } = await import("./transaction.service.js");
    const pricing = await getActivePricingConfig();
    const feeBreakdown = calculateParkingFee(session.checkInAt, session.checkOutAt, pricing);
    session.fee = feeBreakdown.totalFee;
    session.feeBreakdown = feeBreakdown;
    const returnedAt = new Date();
    session.rfidReturnedAt = returnedAt;
    await session.save();
    await createPendingTransactionForSession(session);
    releaseGuestCard(card, returnedAt);
  } else {
    session.fee = 0;
    session.paidAmount = 0;
    session.paymentStatus = "fully_paid";
    session.paymentMethod = "subscription";
    await session.save();
    card.status = "active";
  }
  card.lastUsedAt = new Date();
  await card.save();

  await logScan({
    cardId,
    action: "exit",
    sessionId,
    status: "success",
    performedBy,
    metadata: { overrideMismatch: true },
  });

  return { card, session, confirmed: true };
}

export async function assignCardToSession(
  cardId: string,
  sessionId: string,
  gate: string,
  performedBy?: string,
) {
  const card = await RfidCard.findOne({ cardId: cardId.toUpperCase() });
  if (!card) {
    throw new AppError("Thẻ RFID không tồn tại.", 404);
  }
  if (card.status !== "available") {
    throw new AppError("Thẻ RFID không ở trạng thái sẵn sàng.", 409);
  }

  const session = await ParkingSession.findById(sessionId);
  if (!session) {
    throw new AppError("Không tìm thấy phiên gửi xe.", 404);
  }

  session.rfidCardId = cardId.toUpperCase();
  session.rfidAssignedAt = new Date();
  session.rfidGate = gate as "entry" | "exit";
  await session.save();

  card.status = "in-use";
  card.lastUsedAt = new Date();
  await card.save();

  await logScan({
    cardId,
    action: "assign",
    sessionId,
    status: "success",
    performedBy,
  });

  return { card, session };
}

export async function returnCard(
  cardId: string,
  sessionId: string,
  performedBy?: string,
) {
  const card = await RfidCard.findOne({ cardId: cardId.toUpperCase() });
  if (!card) {
    throw new AppError("Thẻ RFID không tồn tại.", 404);
  }

  const session = await ParkingSession.findById(sessionId);
  if (!session) {
    throw new AppError("Không tìm thấy phiên gửi xe.", 404);
  }

  if (card.cardType === "member") {
    throw new AppError("RFID Member là thẻ sở hữu riêng, không được trả về kho.", 409);
  }

  const returnedAt = new Date();
  session.rfidReturnedAt = returnedAt;
  await session.save();

  releaseGuestCard(card, returnedAt);
  await card.save();

  await logScan({
    cardId,
    action: "return",
    sessionId,
    status: "success",
    performedBy,
  });

  return { card, session };
}

export async function reportLostCard(id: string, performedBy?: string) {
  const card = await RfidCard.findById(id);
  if (!card) {
    throw new AppError("Không tìm thấy thẻ RFID.", 404);
  }

  card.status = "lost";
  card.lostAt = new Date();
  await card.save();

  await logScan({
    cardId: card.cardId ?? card.uid,
    action: "report-lost",
    status: "success",
    performedBy,
  });

  return card;
}

export async function unblockCard(id: string, performedBy?: string) {
  const card = await RfidCard.findById(id);
  if (!card) {
    throw new AppError("Không tìm thấy thẻ RFID.", 404);
  }

  if (card.status !== "blocked") {
    throw new AppError("Thẻ không ở trạng thái bị khóa.", 400);
  }

  card.status = "available";
  card.blockedAt = undefined;
  card.blockedReason = undefined;
  await card.save();

  await logScan({
    cardId: card.cardId ?? card.uid,
    action: "unblock",
    status: "success",
    performedBy,
  });

  return card;
}

// ───────────────── Scan Logs ─────────────────

export async function logScan(data: {
  cardId: string;
  action: "entry" | "exit" | "assign" | "return" | "block" | "unblock" | "report-lost";
  sessionId?: string;
  deviceId?: string;
  performedBy?: string;
  status: "success" | "failed" | "blocked" | "mismatch";
  failureReason?: string;
  plateDetected?: string;
  metadata?: Record<string, unknown>;
}) {
  return RfidScanLog.create({
    cardId: data.cardId.toUpperCase(),
    action: data.action,
    sessionId: data.sessionId ? new mongoose.Types.ObjectId(data.sessionId) : undefined,
    deviceId: data.deviceId ? new mongoose.Types.ObjectId(data.deviceId) : undefined,
    performedBy: data.performedBy ? new mongoose.Types.ObjectId(data.performedBy) : undefined,
    status: data.status,
    failureReason: data.failureReason,
    plateDetected: data.plateDetected?.toUpperCase(),
    metadata: data.metadata,
  });
}

export async function listScanLogs(options: {
  cardId?: string;
  action?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (options.cardId) filter.cardId = options.cardId.toUpperCase();
  if (options.action) filter.action = options.action;
  if (options.status) filter.status = options.status;

  const page = options.page ?? 1;
  const limit = options.limit ?? 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    RfidScanLog.find(filter)
      .populate("performedBy", "name email")
      .populate("sessionId", "plate slot")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    RfidScanLog.countDocuments(filter),
  ]);

  return { logs, total, page, limit };
}

export async function getCardAssignmentHistory(cardId: string) {
  const sessions = await ParkingSession.find({
    rfidCardId: cardId.toUpperCase(),
  })
    .sort({ checkInAt: -1 })
    .limit(50);

  const scans = await RfidScanLog.find({ cardId: cardId.toUpperCase() })
    .sort({ createdAt: -1 })
    .limit(100);

  return { sessions, scans };
}

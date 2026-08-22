import mongoose from "mongoose";
import { RfidCard, RfidCardDocument, RfidCardStatus } from "../models/RfidCard.js";
import { Transaction, TransactionDocument, TransactionType } from "../models/Transaction.js";
import { Vehicle } from "../models/Vehicle.js";
import { RfidScanLog } from "../models/RfidScanLog.js";
import { AppError } from "../utils/AppError.js";

const activeCardStatuses = ["active", "in-use"];
const gateBlockedStatuses = ["inactive", "lost", "blocked", "damaged", "returned", "pending-sale"];

function normalizeCardId(value: string) {
  return value.trim().toUpperCase();
}

function objectId(value?: string) {
  return value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : undefined;
}

async function writeAudit(cardId: string, action: string, status: "success" | "failed", actor?: string, metadata?: Record<string, unknown>) {
  await RfidScanLog.create({ cardId, action: action as any, status, performedBy: objectId(actor), metadata });
}

async function resolveTarget(userId?: string, vehicleId?: string, plate?: string) {
  const vehicle = vehicleId
    ? await Vehicle.findById(vehicleId)
    : plate
      ? await Vehicle.findOne({ plate: plate.trim().toUpperCase() })
      : null;
  if (vehicleId && !vehicle) throw new AppError("Không tìm thấy xe để gán thẻ RFID.", 404);
  if (!vehicle) throw new AppError("Vui lòng chọn xe để bán thẻ RFID Member.", 400);
  const resolvedUserId = vehicle.userId;
  if (!resolvedUserId) throw new AppError("Xe chưa được gắn với tài khoản khách hàng.", 409);
  if (userId && resolvedUserId.toString() !== userId) throw new AppError("Tài khoản khách hàng không sở hữu xe đã chọn.", 409);
  const normalizedPlate = vehicle?.plate || plate?.trim().toUpperCase();
  const duplicateQuery: Record<string, unknown> = { cardType: "member", status: { $in: ["active", "in-use", "pending-sale"] } };
  if (vehicle) duplicateQuery.$or = [{ vehicleId: vehicle._id }, { plate: vehicle.plate }];
  else if (normalizedPlate) duplicateQuery.plate = normalizedPlate;
  if (normalizedPlate) {
    const duplicate = await RfidCard.findOne(duplicateQuery);
    if (duplicate) throw new AppError("Xe đã có thẻ RFID chính đang hoạt động.", 409);
  }
  return { vehicle, userId: resolvedUserId };
}

export type SellRfidCardInput = {
  /** Quy trình này chỉ bán thẻ Member, không cấp thẻ Guest tạm thời. */
  cardType?: "member";
  cardId: string;
  userId?: string;
  vehicleId: string;
  salePrice: number;
  depositAmount: number;
  method: "cash" | "payos" | "wallet";
  note?: string;
  replacementOf?: string;
  freeReason?: string;
  baseUrl?: string;
  frontendUrl?: string;
};

async function finalizeSale(transaction: TransactionDocument) {
  if (!transaction.rfidCardId) throw new AppError("Giao dịch không gắn với thẻ RFID.", 500);
  const card = await RfidCard.findOneAndUpdate(
    { _id: transaction.rfidCardId, status: "pending-sale" },
    {
      $set: {
        // Thẻ Member là tài sản của khách, chỉ chuyển active/in-use theo phiên gửi xe và không được trả về kho.
        status: "active",
        cardType: "member",
        userId: transaction.userId,
        vehicleId: transaction.vehicleId,
        plate: transaction.plate || "",
        ownerName: transaction.vehicleId ? ((await Vehicle.findById(transaction.vehicleId))?.ownerName || "Thành viên") : "Thành viên",
        userType: "resident",
        salePrice: transaction.salePrice ?? 0,
        depositAmount: transaction.depositAmount ?? 0,
        assignedAt: new Date(),
        soldAt: new Date(),
      },
      $unset: { pendingTransactionId: 1 },
    },
    { new: true },
  );
  if (!card) {
    const existing = await RfidCard.findById(transaction.rfidCardId);
    if (existing?.cardType === "member" && ["active", "in-use"].includes(existing.status) && existing.soldAt) return existing;
    throw new AppError("Thẻ RFID không còn ở trạng thái chờ bán.", 409);
  }
  const updatedTransaction = await Transaction.findByIdAndUpdate(transaction._id, { $set: { status: "paid", paidAt: new Date() } }, { new: true });
  if (!updatedTransaction) throw new AppError("Không thể cập nhật trạng thái giao dịch RFID.", 500);
  await writeAudit(card.cardId ?? card.uid, "sale", "success", transaction.createdBy?.toString());
  return card;
}

export async function sellRfidCard(input: SellRfidCardInput, actorId?: string) {
  if (input.salePrice < 0 || input.depositAmount < 0) throw new AppError("Giá bán và tiền cọc không được âm.", 400);
  if (input.salePrice + input.depositAmount > 0 && input.method === "cash" && !actorId) throw new AppError("Giao dịch tiền mặt phải có nhân viên thực hiện.", 403);
  if (input.salePrice + input.depositAmount === 0 && !input.freeReason?.trim()) throw new AppError("Cấp thẻ miễn phí phải ghi rõ lý do.", 400);
  const target = await resolveTarget(input.userId, input.vehicleId);
  const card = await RfidCard.findOneAndUpdate(
    { _id: input.cardId, status: "available" },
    { $set: { status: "pending-sale", pendingTransactionId: new mongoose.Types.ObjectId() } },
    { new: true },
  );
  if (!card) throw new AppError("Thẻ không tồn tại hoặc không ở trạng thái available.", 409);
  const transactionId = card.pendingTransactionId!;
  try {
    const transaction = await Transaction.create({
      _id: transactionId,
      transactionType: input.replacementOf ? "rfid_replacement" : "rfid_sale",
      rfidCardId: card._id,
      replacementOf: objectId(input.replacementOf),
      uid: card.uid,
      rfidCardType: "member",
      plate: target.vehicle!.plate,
      userId: target.userId,
      vehicleId: target.vehicle?._id,
      createdBy: objectId(actorId),
      method: input.method,
      amount: input.salePrice + input.depositAmount,
      salePrice: input.salePrice,
      depositAmount: input.depositAmount,
      status: input.method === "payos" && input.salePrice + input.depositAmount > 0 ? "pending" : "paid",
      paidAt: input.method === "payos" && input.salePrice + input.depositAmount > 0 ? undefined : new Date(),
      note: input.freeReason ? "Cấp miễn phí: " + input.freeReason : input.note,
    });
    if (transaction.status === "paid") {
      await finalizeSale(transaction);
    } else if (input.method === "payos") {
      const { createPayOSPayment } = await import("./payos.service.js");
      const payosResult = await createPayOSPayment({
        amount: transaction.amount,
        sessionId: String(transaction._id),
        label: "iPARK RFID",
        baseUrl: input.baseUrl || process.env.API_URL || process.env.BASE_URL || "http://localhost:4000",
        frontendUrl: input.frontendUrl || process.env.FRONTEND_URL || "http://localhost:3000",
      });
      if (!payosResult.success || !payosResult.orderCode) {
        await Transaction.findByIdAndUpdate(transaction._id, { $set: { status: "failed", note: payosResult.error || "Không tạo được link PayOS" } });
        await RfidCard.findByIdAndUpdate(card._id, { $set: { status: "available" }, $unset: { pendingTransactionId: 1 } });
        throw new AppError(payosResult.error || "Không thể tạo thanh toán PayOS cho thẻ RFID.", 502);
      }
      const updated = await Transaction.findByIdAndUpdate(transaction._id, { $set: { payosOrderCode: String(payosResult.orderCode), payosCheckoutUrl: payosResult.checkoutUrl, payosQrCode: payosResult.qrCode, payosAccountNumber: payosResult.accountNumber, payosAccountName: payosResult.accountName, payosBin: payosResult.bin } }, { new: true });
      return { transaction: updated || transaction, card: await RfidCard.findById(card._id), payos: payosResult };
    }
    return { transaction, card: await RfidCard.findById(card._id) };
  } catch (error) {
    await RfidCard.findByIdAndUpdate(card._id, { $set: { status: "available" }, $unset: { pendingTransactionId: 1 } });
    throw error;
  }
}

export async function sellRfidCardForCustomer(input: { userId: string; vehicleId: string; salePrice: number; depositAmount?: number; baseUrl?: string; frontendUrl?: string }) {
  const target = await resolveTarget(input.userId, input.vehicleId);
  const card = await RfidCard.findOne({ status: "available", cardType: "guest" }).sort({ createdAt: 1 });
  if (!card) throw new AppError("Hiện không còn thẻ RFID để bán. Vui lòng thử lại sau.", 409);
  try {
    return await sellRfidCard({
      cardType: "member",
      cardId: card._id.toString(),
      userId: input.userId,
      vehicleId: input.vehicleId,
      salePrice: input.salePrice,
      depositAmount: input.depositAmount || 0,
      method: "payos",
      baseUrl: input.baseUrl,
      frontendUrl: input.frontendUrl,
    }, input.userId);
  } catch (error) {
    await RfidCard.findByIdAndUpdate(card._id, { $set: { status: "available" }, $unset: { pendingTransactionId: 1 } });
    throw error;
  }
}

export async function finalizePaidRfidTransaction(transactionId: string) {
  const transaction = await Transaction.findOne({ _id: transactionId, transactionType: { $in: ["rfid_sale", "rfid_replacement"] } as any });
  if (!transaction) throw new AppError("Không tìm thấy giao dịch RFID.", 404);
  if (transaction.status !== "paid") throw new AppError("Giao dịch RFID chưa thanh toán.", 409);
  const card = await finalizeSale(transaction);
  return { transaction, card };
}

export async function reconcileCustomerRfidSale(transactionId: string, userId: string) {
  const { checkPayOSPaymentStatus } = await import("./payos.service.js");
  const transaction = await Transaction.findOne({
    _id: transactionId,
    userId: objectId(userId),
    transactionType: { $in: ["rfid_sale", "rfid_replacement"] },
  });
  if (!transaction) throw new AppError("Không tìm thấy giao dịch mua thẻ RFID.", 404);
  if (transaction.status === "pending" && transaction.payosOrderCode) {
    const result = await checkPayOSPaymentStatus(String(transaction.payosOrderCode));
    if (String(result.status).toLowerCase() === "paid") {
      transaction.status = "paid";
      transaction.paidAt = new Date();
      await transaction.save();
      await finalizePaidRfidTransaction(transaction._id.toString());
    }
  }
  return { transaction: await Transaction.findById(transaction._id), card: transaction.rfidCardId ? await RfidCard.findById(transaction.rfidCardId) : null };
}

export async function reconcilePendingRfidSales() {
  const { checkPayOSPaymentStatus } = await import("./payos.service.js");
  const pending = await Transaction.find({
    transactionType: { $in: ["rfid_sale", "rfid_replacement"] },
    status: "pending",
    payosOrderCode: { $exists: true, $ne: null },
  });
  let updated = 0;
  for (const transaction of pending) {
    const status = await checkPayOSPaymentStatus(String(transaction.payosOrderCode));
    if (String(status.status).toLowerCase() !== "paid") continue;
    transaction.status = "paid";
    transaction.paidAt = new Date();
    await transaction.save();
    await finalizePaidRfidTransaction(transaction._id.toString());
    updated += 1;
  }
  return { checked: pending.length, updated };
}

export async function confirmRfidSale(transactionId: string, actorId?: string) {
  const transaction = await Transaction.findOne({ _id: transactionId, transactionType: { $in: ["rfid_sale", "rfid_replacement"] } as any });
  if (!transaction) throw new AppError("Không tìm thấy giao dịch bán thẻ RFID.", 404);
  if (transaction.status === "paid") return finalizePaidRfidTransaction(transactionId);
  if (transaction.status !== "pending") throw new AppError("Giao dịch không ở trạng thái chờ thanh toán.", 409);
  if (actorId) transaction.createdBy = objectId(actorId);
  const card = await finalizeSale(transaction);
  return { transaction, card };
}

export async function getRfidCardDetails(cardId: string) {
  const card = await RfidCard.findById(cardId)
    .populate("userId", "name email phone")
    .populate("vehicleId", "plate ownerName brand model color status");
  if (!card) throw new AppError("Không tìm thấy thẻ RFID.", 404);
  const history = await Transaction.find({ rfidCardId: card._id })
    .sort({ createdAt: -1 })
    .limit(50);
  return { card, history };
}

export async function listRfidInventory(filters: { status?: RfidCardStatus; search?: string; page?: number; limit?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.search?.trim()) {
    const value = filters.search.trim();
    query.$or = [{ uid: new RegExp(value, "i") }, { cardId: new RegExp(value, "i") }, { plate: new RegExp(value, "i") }, { ownerName: new RegExp(value, "i") }];
  }
  const [items, total] = await Promise.all([
    RfidCard.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    RfidCard.countDocuments(query),
  ]);
  const summary = await RfidCard.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  return { items, total, page, limit, summary };
}

export async function listRfidTransactions(filters: { status?: string; page?: number; limit?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const query: Record<string, unknown> = { transactionType: { $in: ["rfid_sale", "rfid_replacement", "rfid_refund", "rfid_deposit"] } };
  if (filters.status) query.status = filters.status;
  const [items, total] = await Promise.all([
    Transaction.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("rfidCardId", "uid cardId cardType status").populate("vehicleId", "plate ownerName"),
    Transaction.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function changeRfidCardStatus(id: string, status: Extract<RfidCardStatus, "lost" | "blocked" | "damaged" | "available">, reason: string | undefined, actorId?: string) {
  const card = await RfidCard.findById(id);
  if (!card) throw new AppError("Không tìm thấy thẻ RFID.", 404);
  if (status === "available" && card.status === "in-use") throw new AppError("Không thể mở lại thẻ đang gán cho xe; hãy dùng quy trình trả thẻ.", 409);
  card.status = status;
  if (status === "available" && card.cardType === "guest") {
    card.plate = "";
    card.ownerName = "Guest";
    card.userId = undefined;
    card.vehicleId = undefined;
    card.returnedAt = new Date();
  }
  if (status === "lost") card.lostAt = new Date();
  if (status === "blocked") { card.blockedAt = new Date(); card.blockedReason = reason?.trim() || "Khóa theo yêu cầu vận hành"; }
  if (status === "damaged") { card.damagedAt = new Date(); card.damagedReason = reason?.trim() || "Thẻ hỏng"; }
  await card.save();
  // Scan-log uses the historical `block` action name while card status is `blocked`.
  const auditAction = status === "blocked" ? "block" : status;
  await writeAudit(card.cardId ?? card.uid, auditAction, "success", actorId, { reason });
  return card;
}

export async function returnRfidCard(id: string, options: { inspectionPassed: boolean; refundDeposit: boolean; refundReason?: string }, actorId?: string) {
  const card = await RfidCard.findById(id);
  if (!card) throw new AppError("Không tìm thấy thẻ RFID.", 404);
  if (card.cardType !== "guest") throw new AppError("RFID Member là thẻ bán đứt, không được trả về kho.", 409);
  if (!activeCardStatuses.includes(card.status)) throw new AppError("Chỉ có thể trả thẻ Guest đang được sử dụng.", 409);
  const oldVehicleId = card.vehicleId;
  card.returnedAt = new Date();
  card.lastUsedAt = new Date();
  card.status = options.inspectionPassed ? "available" : "returned";
  card.userId = undefined;
  card.vehicleId = undefined;
  card.plate = "";
  card.ownerName = "Guest";
  await card.save();
  let refund: TransactionDocument | null = null;
  if (options.refundDeposit && (card.depositAmount ?? 0) > 0) {
    refund = await Transaction.create({ transactionType: "rfid_refund", rfidCardId: card._id, uid: card.uid, vehicleId: oldVehicleId, createdBy: objectId(actorId), method: "cash", amount: card.depositAmount ?? 0, depositAmount: card.depositAmount ?? 0, status: "paid", paidAt: new Date(), refundReason: options.refundReason || "Hoàn cọc khi trả thẻ" });
  }
  await writeAudit(card.cardId ?? card.uid, "return", "success", actorId, { inspectionPassed: options.inspectionPassed, refundDeposit: options.refundDeposit });
  return { card, refund };
}

export async function replaceRfidCard(id: string, input: Omit<SellRfidCardInput, "replacementOf">, actorId?: string) {
  const oldCard = await RfidCard.findById(id);
  if (!oldCard) throw new AppError("Không tìm thấy thẻ RFID cũ.", 404);
  if (oldCard.cardType !== "member") throw new AppError("Chỉ cấp lại thẻ cho RFID Member bán đứt.", 409);
  if (!["lost", "damaged", "blocked"].includes(oldCard.status)) throw new AppError("Chỉ được cấp lại thẻ cho thẻ mất, hỏng hoặc bị khóa.", 409);
  const result = await sellRfidCard({ ...input, cardType: "member", userId: input.userId || oldCard.userId?.toString(), vehicleId: input.vehicleId || oldCard.vehicleId?.toString() || "", replacementOf: oldCard._id.toString() }, actorId);
  oldCard.replacedBy = result.card?._id;
  await oldCard.save();
  await writeAudit(oldCard.cardId ?? oldCard.uid, "replace", "success", actorId, { replacementCardId: result.card?._id?.toString() });
  return { oldCard, ...result };
}

export function isRfidCardBlocked(status: string) {
  return gateBlockedStatuses.includes(status);
}

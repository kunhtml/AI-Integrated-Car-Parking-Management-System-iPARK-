import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { RfidPurchaseRequest } from "../models/RfidPurchaseRequest.js";
import { Vehicle } from "../models/Vehicle.js";
import { RfidCard } from "../models/RfidCard.js";
import { Transaction } from "../models/Transaction.js";
import { checkPayOSPaymentStatus, createPayOSPayment } from "../services/payos.service.js";

const cardPrice = () => Number(process.env.RFID_CARD_SALE_PRICE || 50000);

async function reconcilePurchaseRequestPayment(item: InstanceType<typeof RfidPurchaseRequest>) {
  if (item.status !== "pending_payment" || !item.transactionId) return false;

  const transaction = await Transaction.findById(item.transactionId);
  if (!transaction) return false;

  if (transaction.status !== "paid" && transaction.payosOrderCode) {
    const result = await checkPayOSPaymentStatus(String(transaction.payosOrderCode));
    if (result.status === "paid") {
      transaction.status = "paid";
      transaction.paidAt ||= new Date();
      await transaction.save();
    }
  }

  if (transaction.status !== "paid") return false;
  item.status = "waiting_issuance";
  await item.save();
  return true;
}
function serialize(item: any) { return { id: item._id.toString(), userId: item.userId?.toString(), vehicleId: item.vehicleId?._id?.toString?.() || item.vehicleId?.toString(), vehicle: item.vehicleId && typeof item.vehicleId === "object" ? { plate: item.vehicleId.plate, ownerName: item.vehicleId.ownerName, status: item.vehicleId.status } : null, status: item.status, salePrice: item.salePrice, card: item.rfidCardId && typeof item.rfidCardId === "object" ? { id: item.rfidCardId._id.toString(), uid: item.rfidCardId.uid, cardId: item.rfidCardId.cardId } : null, transactionId: item.transactionId?.toString(), rejectionReason: item.rejectionReason, note: item.note, createdAt: item.createdAt }; }

export async function createPurchaseRequest(request: Request, response: Response) {
  const body = z.object({ vehicleId: z.string().min(1), note: z.string().trim().max(500).optional() }).parse(request.body);
  const vehicle = await Vehicle.findOne({ _id: body.vehicleId, userId: request.user!.id, status: "Đã đăng ký" });
  if (!vehicle) return void response.status(409).json({ message: "Chỉ được mua thẻ cho phương tiện đã được xác minh." });
  const existingCard = await RfidCard.findOne({ vehicleId: vehicle._id, cardType: "member", status: { $in: ["active", "in-use", "pending-sale"] } });
  if (existingCard) return void response.status(409).json({ message: "Phương tiện đã có RFID Member đang hoạt động." });
  const existingRequest = await RfidPurchaseRequest.findOne({ vehicleId: vehicle._id, status: { $in: ["pending_payment", "waiting_issuance", "approved_waiting_assignment"] } });
  if (existingRequest) return void response.status(409).json({ message: "Phương tiện đã có yêu cầu mua thẻ đang xử lý." });
  const item = await RfidPurchaseRequest.create({ userId: request.user!.id, vehicleId: vehicle._id, salePrice: cardPrice(), note: body.note });
  const transaction = await Transaction.create({ transactionType: "rfid_sale", rfidCardType: "member", plate: vehicle.plate, userId: request.user!.id, vehicleId: vehicle._id, method: "payos", amount: item.salePrice, salePrice: item.salePrice, status: "pending" });
  item.transactionId = transaction._id; await item.save();
  response.status(201).json({ request: serialize(item), transactionId: transaction._id.toString() });
}
export async function listMyPurchaseRequests(request: Request, response: Response) { const items = await RfidPurchaseRequest.find({ userId: request.user!.id }).sort({ createdAt: -1 }); await Promise.all(items.map((item) => reconcilePurchaseRequestPayment(item))); await Promise.all(items.map((item) => item.populate("vehicleId", "plate ownerName status").then(() => item.populate("rfidCardId", "uid cardId")))); response.json({ requests: items.map(serialize) }); }
export async function listPurchaseRequests(_request: Request, response: Response) { const items = await RfidPurchaseRequest.find().sort({ createdAt: -1 }); await Promise.all(items.map((item) => reconcilePurchaseRequestPayment(item))); await Promise.all(items.map((item) => item.populate("vehicleId", "plate ownerName status").then(() => item.populate("rfidCardId", "uid cardId")))); response.json({ requests: items.map(serialize) }); }
export async function payPurchaseRequest(request: Request, response: Response) {
  const item = await RfidPurchaseRequest.findOne({ _id: request.params.id, userId: request.user!.id, status: "pending_payment" });
  if (!item?.transactionId) return void response.status(409).json({ message: "Yêu cầu không chờ thanh toán." });
  const transaction = await Transaction.findById(item.transactionId); if (!transaction) return void response.status(404).json({ message: "Không tìm thấy giao dịch." });
  const payment = await createPayOSPayment({ amount: transaction.amount, sessionId: transaction._id.toString(), label: "iPARK RFID", baseUrl: `${request.protocol}://${request.get("host")}`, frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000" });
  if (!payment.success) return void response.status(502).json({ message: payment.error || "Không tạo được PayOS." });
  transaction.payosOrderCode = String(payment.orderCode); transaction.payosCheckoutUrl = payment.checkoutUrl; transaction.payosQrCode = payment.qrCode; await transaction.save();
  response.json({ request: serialize(item), transactionId: transaction._id.toString(), payos: payment });
}
export async function reconcilePurchaseRequest(request: Request, response: Response) {
  const item = await RfidPurchaseRequest.findById(request.params.id);
  if (!item) return void response.status(404).json({ message: "Không tìm thấy yêu cầu mua thẻ." });
  if (request.user!.role === "customer" && item.userId.toString() !== request.user!.id) return void response.status(403).json({ message: "Không có quyền truy cập yêu cầu này." });
  await reconcilePurchaseRequestPayment(item);
  await item.populate("vehicleId", "plate ownerName status");
  await item.populate("rfidCardId", "uid cardId");
  response.json({ request: serialize(item) });
}
export async function reviewPurchaseRequest(request: Request, response: Response) {
  const body = z.object({ action: z.enum(["approve", "reject"]), reason: z.string().trim().max(500).optional() }).parse(request.body);
  const item = await RfidPurchaseRequest.findById(request.params.id);
  if (!item || item.status !== "waiting_issuance") return void response.status(409).json({ message: "Yêu cầu phải thanh toán xong trước khi duyệt cấp thẻ." });
  item.status = body.action === "approve" ? "approved_waiting_assignment" : "rejected"; item.reviewedBy = new mongoose.Types.ObjectId(request.user!.id); item.reviewedAt = new Date(); item.rejectionReason = body.action === "reject" ? body.reason : undefined; await item.save(); response.json({ request: serialize(item) });
}
export async function assignPurchaseCard(request: Request, response: Response) {
  const body = z.object({ uid: z.string().trim().min(1) }).parse(request.body); const item = await RfidPurchaseRequest.findById(request.params.id).populate("vehicleId");
  if (!item || item.status !== "approved_waiting_assignment") return void response.status(409).json({ message: "Yêu cầu chưa được phê duyệt để cấp thẻ." });
  const vehicle: any = item.vehicleId; const card = await RfidCard.findOne({ uid: body.uid.toUpperCase(), status: "available", cardType: "guest" });
  if (!card) return void response.status(409).json({ message: "UID không phải thẻ trống trong kho." });
  card.status = "active"; card.cardType = "member"; card.userId = item.userId; card.vehicleId = vehicle._id; card.plate = vehicle.plate; card.ownerName = vehicle.ownerName; card.userType = "resident"; card.assignedAt = new Date(); card.soldAt = new Date(); await card.save();
  const transaction = item.transactionId ? await Transaction.findById(item.transactionId) : null; if (transaction) { transaction.rfidCardId = card._id; transaction.uid = card.uid; transaction.status = "paid"; transaction.paidAt ||= new Date(); await transaction.save(); }
  item.rfidCardId = card._id; item.issuedBy = new mongoose.Types.ObjectId(request.user!.id); item.issuedAt = new Date(); item.status = "completed"; await item.save(); response.json({ request: serialize(await item.populate("rfidCardId", "uid cardId")) });
}

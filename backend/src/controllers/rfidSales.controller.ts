import { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../utils/AppError.js";
import { getActivePricingConfig } from "../services/pricing.service.js";
import { RfidCardStatus } from "../models/RfidCard.js";
import { changeRfidCardStatus, confirmRfidSale, getRfidCardDetails, listRfidInventory, listRfidTransactions, replaceRfidCard, returnRfidCard, sellRfidCard, sellRfidCardForCustomer, reconcilePendingRfidSales, reconcileCustomerRfidSale } from "../services/rfidSales.service.js";

function actor(request: Request) { return request.user?.id; }
function serializeCard(card: any) { return card ? { id: card._id?.toString?.() ?? card.id, uid: card.uid, cardId: card.cardId, status: card.status, cardType: card.cardType, userId: card.userId?.toString?.(), vehicleId: card.vehicleId?.toString?.(), plate: card.plate, ownerName: card.ownerName, blockedReason: card.blockedReason, notes: card.notes, salePrice: card.salePrice ?? 0, depositAmount: card.depositAmount ?? 0, assignedAt: card.assignedAt, soldAt: card.soldAt, returnedAt: card.returnedAt, lostAt: card.lostAt, damagedAt: card.damagedAt, blockedAt: card.blockedAt, createdAt: card.createdAt, updatedAt: card.updatedAt } : null; }
function serializeTransaction(tx: any) { return tx ? { id: tx._id?.toString?.() ?? tx.id, transactionType: tx.transactionType, rfidCardId: tx.rfidCardId?._id?.toString?.() ?? tx.rfidCardId?.toString?.(), uid: tx.uid, rfidCardType: tx.rfidCardType, userId: tx.userId?.toString?.(), vehicleId: tx.vehicleId?._id?.toString?.() ?? tx.vehicleId?.toString?.(), amount: tx.amount, salePrice: tx.salePrice ?? 0, depositAmount: tx.depositAmount ?? 0, method: tx.method, status: tx.status, note: tx.note, paidAt: tx.paidAt, createdAt: tx.createdAt, payosCheckoutUrl: tx.payosCheckoutUrl, payosQrCode: tx.payosQrCode } : null; }

const saleSchema = z.object({ cardType: z.literal("member").default("member"), cardId: z.string().min(1), userId: z.string().optional(), vehicleId: z.string().min(1), salePrice: z.coerce.number().min(0), depositAmount: z.coerce.number().min(0), method: z.enum(["cash", "payos", "wallet"]).default("cash"), note: z.string().optional(), freeReason: z.string().optional() });
const statusSchema = z.object({ reason: z.string().optional() });

export async function inventory(request: Request, response: Response) { const data = await listRfidInventory({ status: request.query.status as RfidCardStatus | undefined, search: request.query.search as string | undefined, page: Number(request.query.page) || 1, limit: Number(request.query.limit) || 20 }); response.json({ ...data, items: data.items.map(serializeCard) }); }
export async function transactions(request: Request, response: Response) { const data = await listRfidTransactions({ status: request.query.status as string | undefined, page: Number(request.query.page) || 1, limit: Number(request.query.limit) || 20 }); response.json({ ...data, items: data.items.map(serializeTransaction) }); }
export async function sell(request: Request, response: Response) { const input = saleSchema.parse(request.body); const result = await sellRfidCard({ ...input, baseUrl: process.env.API_URL || `${request.protocol}://${request.get("host")}`, frontendUrl: process.env.FRONTEND_URL || `${request.protocol}://${request.get("host")}` }, actor(request)); response.status(201).json({ transaction: serializeTransaction(result.transaction), card: serializeCard(result.card) }); }
export async function confirmSale(request: Request, response: Response) { const result = await confirmRfidSale(String(request.params.transactionId), actor(request)); response.json({ transaction: serializeTransaction(result.transaction), card: serializeCard(result.card) }); }
export async function updateStatus(request: Request, response: Response) { const body = statusSchema.parse(request.body); const status = String(request.params.action) as "lost" | "blocked" | "damaged"; if (!["lost", "blocked", "damaged"].includes(status)) throw new AppError("Trạng thái RFID không hợp lệ.", 400); const card = await changeRfidCardStatus(String(request.params.id), status, body.reason, actor(request)); response.json({ card: serializeCard(card) }); }
export async function returnCard(request: Request, response: Response) { const body = z.object({ inspectionPassed: z.coerce.boolean().default(true), refundDeposit: z.coerce.boolean().default(false), refundReason: z.string().optional() }).parse(request.body); const result = await returnRfidCard(String(request.params.id), body, actor(request)); response.json({ card: serializeCard(result.card), refund: serializeTransaction(result.refund) }); }
export async function replaceCard(request: Request, response: Response) { const input = saleSchema.parse(request.body); const result = await replaceRfidCard(String(request.params.id), input, actor(request)); response.status(201).json({ oldCard: serializeCard(result.oldCard), card: serializeCard(result.card), transaction: serializeTransaction(result.transaction) }); }


export async function sellForCustomer(request: Request, response: Response) {
  const userId = actor(request);
  if (!userId) throw new AppError("Chưa đăng nhập.", 401);
  const input = z.object({ vehicleId: z.string().min(1) }).parse(request.body);
  const pricing = await getActivePricingConfig();
  const salePrice = Number(pricing.rfidCardSalePrice ?? 50000);
  const result = await sellRfidCardForCustomer({ userId, vehicleId: input.vehicleId, salePrice, depositAmount: 0, baseUrl: process.env.API_URL || `${request.protocol}://${request.get("host")}`, frontendUrl: process.env.FRONTEND_URL || `${request.protocol}://${request.get("host")}` });
  response.status(201).json({ transaction: serializeTransaction(result.transaction), card: serializeCard(result.card), payos: (result as any).payos });
}


export async function reconcilePending(request: Request, response: Response) {
  response.json(await reconcilePendingRfidSales());
}


export async function reconcileCustomerSale(request: Request, response: Response) {
  const userId = actor(request);
  if (!userId) throw new AppError("Chưa đăng nhập.", 401);
  const result = await reconcileCustomerRfidSale(String(request.params.transactionId), userId);
  response.json({ transaction: serializeTransaction(result.transaction), card: serializeCard(result.card) });
}


export async function cardDetails(request: Request, response: Response) {
  const result = await getRfidCardDetails(String(request.params.id));
  response.json({
    card: serializeCard(result.card),
    owner: result.card.userId && typeof result.card.userId === "object" ? result.card.userId : null,
    vehicle: result.card.vehicleId && typeof result.card.vehicleId === "object" ? result.card.vehicleId : null,
    history: result.history.map(serializeTransaction),
  });
}

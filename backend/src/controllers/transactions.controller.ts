import { Request, Response } from "express";
import { z } from "zod";
import { ParkingSession } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";
import { createNotification } from "../services/notification.service.js";
import { createPendingTransactionForSession, objectId } from "../services/transaction.service.js";
import { serializeTransaction } from "../utils/serializers.js";

export async function listTransactions(request: Request, response: Response) {
  const criteria = request.user?.role === "customer" ? { userId: request.user.id } : {};
  const transactions = await Transaction.find(criteria).sort({ createdAt: -1 }).limit(200);
  response.json({ transactions: transactions.map(serializeTransaction) });
}

export async function createSessionTransaction(request: Request, response: Response) {
  const session = await ParkingSession.findById(request.params.sessionId);
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên đỗ xe." });
    return;
  }

  if (request.user?.role === "customer" && session.ownerUserId?.toString() !== request.user.id) {
    response.status(403).json({ message: "Không có quyền tạo giao dịch cho phiên này." });
    return;
  }

  const transaction = await createPendingTransactionForSession(session);
  await session.save();

  response.status(201).json({
    transaction: transaction ? serializeTransaction(transaction) : null,
    sessionPaymentStatus: session.paymentStatus,
    message: transaction ? "Đã tạo giao dịch VietQR." : "Phiên không phát sinh phí.",
  });
}

export async function confirmTransaction(request: Request, response: Response) {
  const body = z.object({ note: z.string().optional() }).parse(request.body);
  const transaction = await Transaction.findById(request.params.id);
  if (!transaction) {
    response.status(404).json({ message: "Không tìm thấy giao dịch." });
    return;
  }

  transaction.status = "paid";
  transaction.paidAt = new Date();
  transaction.confirmedBy = objectId(request.user?.id);
  transaction.note = body.note;
  await transaction.save();

  if (transaction.sessionId) {
    await ParkingSession.findByIdAndUpdate(transaction.sessionId, {
      paymentStatus: "paid",
      transactionId: transaction._id,
    });
  }

  await createNotification({
    title: "Thanh toán đã xác nhận",
    content: `Giao dịch ${transaction.content} đã được xác nhận.`,
    targetRole: "admin",
  });

  response.json({ transaction: serializeTransaction(transaction) });
}

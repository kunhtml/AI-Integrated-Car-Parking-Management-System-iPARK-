import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { ParkingSession } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { createNotification } from "../services/notification.service.js";
import { objectId } from "../services/transaction.service.js";
import { createPayOSPayment } from "../services/payos.service.js";
import { serializeTransaction } from "../utils/serializers.js";

export async function listTransactions(request: Request, response: Response) {
  let transactions;

  if (request.user?.role === "customer") {
    // Find all sessions owned by this user first.
    // Some legacy sessions may be missing ownerUserId but still have ownerEmail,
    // so we match by both criteria to be safe.
    const user = await User.findById(request.user.id).select("email");
    const emailMatch = user?.email ? { ownerEmail: user.email.toLowerCase() } : null;
    const userIdMatch = { ownerUserId: request.user.id };

    const sessionFilter = emailMatch
      ? { $or: [userIdMatch, emailMatch] }
      : userIdMatch;
    const userSessions = await ParkingSession.find(sessionFilter, { _id: 1 });
    const sessionIds = userSessions.map((s) => s._id);

    // Return transactions that either:
    // 1. have userId === current user (e.g. TOPUP, direct cash, subscription payments)
    // 2. are linked to a session owned by this user
    transactions = await Transaction.find({
      $or: [
        { userId: request.user.id },
        { sessionId: { $in: sessionIds } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(200);
  } else {
    // Admin/staff: return all
    transactions = await Transaction.find({})
      .sort({ createdAt: -1 })
      .limit(200);
  }

  const txSessionIds = transactions
    .filter((t) => t.sessionId)
    .map((t) => t.sessionId as mongoose.Types.ObjectId);
  const sessions =
    txSessionIds.length > 0
      ? await ParkingSession.find({ _id: { $in: txSessionIds } })
      : [];
  const sessionMap = new Map(sessions.map((s) => [s._id.toString(), s]));

  const serialized = transactions.map((t) =>
    serializeTransaction(t, sessionMap.get(t.sessionId?.toString() ?? "")),
  );

  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.json({ transactions: serialized });
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

  const { PaymentConfig } = await import("../models/PaymentConfig.js");
  const config = await PaymentConfig.findOne({ isActive: true });

  const payosClientId = config?.payosClientId || process.env.PAYTOS_CLIENT_ID;
  const payosApiKey = config?.payosApiKey || process.env.PAYTOS_API_KEY;
  const payosEnabled = (config?.payosEnabled || process.env.PAYTOS_USE === "true") && payosClientId && payosApiKey;

  // Lưu prepaid info nếu có
  if (session.status === "Đang gửi") {
    const { expectedExitTime, ownerEmail } = request.body as { expectedExitTime?: string; ownerEmail?: string };
    if (expectedExitTime) {
      session.prepaidCheckoutAt = new Date(expectedExitTime);
    } else {
      session.prepaidCheckoutAt = new Date();
    }
    if (ownerEmail && !session.ownerEmail) {
      session.ownerEmail = ownerEmail;
    }
  }
  await session.save();

  // Không phí → coi như đã thanh toán
  if (session.fee == null || session.fee <= 0) {
    session.paymentStatus = "fully_paid";
    session.paidAmount = 0;
    await session.save();
    response.status(201).json({
      transaction: null,
      sessionPaymentStatus: "fully_paid",
      message: "Phiên không phát sinh phí.",
    });
    return;
  }

  // Đã thanh toán đủ
  if (session.paymentStatus === "fully_paid" || (session.paidAmount || 0) >= session.fee) {
    response.status(201).json({
      transaction: null,
      sessionPaymentStatus: "fully_paid",
      message: "Phiên đã thanh toán đủ.",
    });
    return;
  }

  if (payosEnabled) {
    const baseUrl = process.env.API_URL || process.env.BASE_URL || "http://localhost:4000";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const amount = session.fee - (session.paidAmount || 0);

    const payosResult = await createPayOSPayment({
      amount,
      sessionId: String(session._id),
      label: "iPARK",
      baseUrl,
      frontendUrl,
    });

    if (payosResult.success) {
      // Lưu giao dịch pending để webhook / reconcile đối chiếu theo payosOrderCode
      await Transaction.create({
        sessionId: session._id,
        userId: session.ownerUserId,
        method: "payos",
        amount,
        status: "pending",
        note: `IPARK-${String(session._id)}`,
        payosOrderCode: String(payosResult.orderCode),
      });
      response.status(201).json({
        transaction: null,
        sessionPaymentStatus: session.paymentStatus,
        message: "Đã tạo liên kết thanh toán PayOS.",
        payos: {
          qrCode: payosResult.qrCode,
          checkoutUrl: payosResult.checkoutUrl,
          orderCode: payosResult.orderCode,
          amount,
          accountNumber: payosResult.accountNumber,
          accountName: payosResult.accountName,
          bin: payosResult.bin,
          description: payosResult.description,
        },
      });
      return;
    } else {
      console.error("[Transactions] PayOS failed:", payosResult.error);
      response.status(500).json({ message: "Không thể tạo liên kết thanh toán. Vui lòng thử lại sau." });
      return;
    }
  }

  response.status(500).json({ message: "Thanh toán PayOS chưa được kích hoạt. Vui lòng liên hệ quản trị viên." });
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
  transaction.note = body.note;
  await transaction.save();

  if (transaction.sessionId) {
    await ParkingSession.findByIdAndUpdate(transaction.sessionId, {
      paymentStatus: "fully_paid",
      transactionId: transaction._id,
    });
  }

  await createNotification({
    title: "Thanh toán đã xác nhận",
    content: `Giao dịch ${transaction._id} đã được xác nhận.`,
    targetRole: "admin",
  });

  response.json({ transaction: serializeTransaction(transaction) });
}

export async function cancelTransaction(request: Request, response: Response) {
  const transaction = await Transaction.findById(request.params.id);
  if (!transaction) {
    response.status(404).json({ message: "Không tìm thấy giao dịch." });
    return;
  }

  // Chỉ cho phép hủy giao dịch đang ở trạng thái pending
  if (transaction.status !== "pending") {
    response.status(400).json({ message: "Chỉ có thể hủy giao dịch đang chờ thanh toán." });
    return;
  }

  // Cập nhật trạng thái giao dịch thành cancelled
  transaction.status = "cancelled";
  await transaction.save();

  // Reset payment status của session về unpaid (nếu có)
  if (transaction.sessionId) {
    await ParkingSession.findByIdAndUpdate(transaction.sessionId, {
      paymentStatus: "unpaid",
      $unset: { transactionId: "" },
    });
  }

  response.json({ message: "Đã hủy giao dịch." });
}

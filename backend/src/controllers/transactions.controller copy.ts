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
  const criteria = request.user?.role === "customer" ? { userId: request.user.id } : {};
  const transactions = await Transaction.find(criteria).sort({ createdAt: -1 }).limit(200);

  const sessionIds = transactions
    .filter((t) => t.sessionId)
    .map((t) => t.sessionId as mongoose.Types.ObjectId);
  const sessions =
    sessionIds.length > 0
      ? await ParkingSession.find({ _id: { $in: sessionIds } })
      : [];
  const sessionMap = new Map(sessions.map((s) => [s._id.toString(), s]));

  response.json({
    transactions: transactions.map((t) =>
      serializeTransaction(t, sessionMap.get(t.sessionId?.toString() ?? "")),
    ),
  });
}

export async function createSessionTransaction(request: Request, response: Response) {
  console.log("[Transactions] createSessionTransaction called for session:", request.params.sessionId);
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

  console.log("[Transactions] PayOS check:", {
    payosEnabled,
    clientId: payosClientId ? "set" : "missing",
    apiKey: payosApiKey ? "set" : "missing",
  });

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
      console.log("[Transactions] PayOS payment link created:", { orderCode: payosResult.orderCode });
      // Lưu giao dịch pending để webhook / reconcile đối chiếu theo payosOrderCode
      await Transaction.create({
        sessionId: session._id,
        userId: session.ownerUserId,
        method: "payos",
        gateway: "payos",
        amount,
        status: "pending",
        content: `IPARK-${String(session._id)}`,
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

// --- CU-05: Wallet Top-up ---

export async function topUpWallet(request: Request, response: Response) {
  const body = z.object({ amount: z.number().int().min(10000) }).parse(request.body);
  const user = await User.findById(request.user?.id);
  if (!user) {
    response.status(401).json({ message: "Chưa đăng nhập." });
    return;
  }

  const transaction = await Transaction.create({
    userId: user._id,
    method: "payos",
    amount: body.amount,
    status: "pending",
    content: `TOPUP-${user._id.toString().slice(-6)}-${Date.now()}`,
  });

  response.status(201).json({
    transaction: serializeTransaction(transaction),
    message: `Đã tạo yêu cầu nạp ${body.amount.toLocaleString("vi-VN")} VND. Chờ admin xác nhận.`,
  });
}

export async function confirmTopUp(request: Request, response: Response) {
  const transaction = await Transaction.findById(request.params.id);
  if (!transaction || !transaction.content?.startsWith("TOPUP")) {
    response.status(404).json({ message: "Không tìm thấy giao dịch nạp tiền." });
    return;
  }
  if (transaction.status === "paid") {
    response.status(400).json({ message: "Giao dịch đã được xác nhận trước đó." });
    return;
  }

  transaction.status = "paid";
  transaction.paidAt = new Date();
  transaction.confirmedBy = objectId(request.user?.id);
  await transaction.save();

  if (transaction.userId) {
    await User.findByIdAndUpdate(transaction.userId, {
      $inc: { wallet: transaction.amount },
    });
  }

  response.json({
    transaction: serializeTransaction(transaction),
    message: `Đã nạp ${transaction.amount.toLocaleString("vi-VN")} VND vào ví.`,
  });
}

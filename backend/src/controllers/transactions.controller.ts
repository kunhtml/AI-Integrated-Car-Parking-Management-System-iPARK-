import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { ParkingSession } from "../models/ParkingSession.js";
import { Transaction, TransactionDocument } from "../models/Transaction.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { createNotification } from "../services/notification.service.js";
import { objectId } from "../services/transaction.service.js";
import { createPayOSPayment } from "../services/payos.service.js";
import { serializeTransaction } from "../utils/serializers.js";
import { createAuditLog } from "../services/auditLog.service.js";

export async function listTransactions(request: Request, response: Response) {
  const {
    q,
    status,
    method,
    sessionId,
    transactionType,
    plate,
    from,
    to,
    page = "1",
    limit = "50",
  } = request.query as Record<string, string>;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (method) filter.method = method;
  if (sessionId) filter.sessionId = sessionId;
  if (transactionType) filter.transactionType = transactionType;
  if (plate) filter.plate = { $regex: plate, $options: "i" };

  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = new Date(from);
    if (to) createdAt.$lte = new Date(to);
    filter.createdAt = createdAt;
  }

  if (q) {
    const regex = new RegExp(q, "i");
    const orConditions: Record<string, unknown>[] = [
      { plate: regex },
      { note: regex },
      { payosOrderCode: q },
      { sessionId: q },
    ];
    if (mongoose.isValidObjectId(q)) {
      orConditions.push({ _id: q }, { userId: q }, { subscriptionId: q });
    }
    filter.$or = orConditions;
  }

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  let transactions: TransactionDocument[];
  let total: number;
  if (request.user?.role === "customer") {
    const user = await User.findById(request.user.id).select("email");
    const emailMatch = user?.email
      ? { ownerEmail: user.email.toLowerCase() }
      : null;
    const userIdMatch = { ownerUserId: request.user.id };
    const sessionFilter = emailMatch
      ? { $or: [userIdMatch, emailMatch] }
      : userIdMatch;
    const userSessions = await ParkingSession.find(sessionFilter, { _id: 1 });
    const sessionIds = userSessions.map((s) => s._id);
    const userSubscriptions = await Subscription.find(
      { userId: request.user.id },
      { _id: 1 },
    );
    const subscriptionIds = userSubscriptions.map((s) => s._id);
    const accessFilter: Record<string, unknown> = {
      $or: [
        ...(Array.isArray(filter.$or) ? filter.$or : []),
        { userId: request.user.id },
        { sessionId: { $in: sessionIds } },
        { subscriptionId: { $in: subscriptionIds } },
      ],
    };
    const customerFilter = { $and: [accessFilter, filter] };
    [transactions, total] = await Promise.all([
      Transaction.find(customerFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Transaction.countDocuments(customerFilter),
    ]);
  } else {
    [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Transaction.countDocuments(filter),
    ]);
  }

  const txSessionIds = transactions
    .filter((t) => t.sessionId)
    .map((t) => t.sessionId as mongoose.Types.ObjectId);
  const txSubscriptionIds = transactions
    .filter((t) => t.subscriptionId)
    .map((t) => t.subscriptionId as mongoose.Types.ObjectId);
  const [sessions, subscriptions] = await Promise.all([
    txSessionIds.length > 0
      ? ParkingSession.find({ _id: { $in: txSessionIds } })
      : [],
    txSubscriptionIds.length > 0
      ? Subscription.find({ _id: { $in: txSubscriptionIds } })
      : [],
  ]);
  const sessionMap = new Map(sessions.map((s) => [s._id.toString(), s]));
  const subscriptionMap = new Map(
    subscriptions.map((s) => [s._id.toString(), s]),
  );
  const serialized = transactions.map((t) =>
    serializeTransaction(
      t,
      sessionMap.get(t.sessionId?.toString() ?? ""),
      subscriptionMap.get(t.subscriptionId?.toString() ?? ""),
    ),
  );

  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.json({
    transactions: serialized,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasMore: skip + serialized.length < total,
    },
    total,
    page: pageNum,
    limit: limitNum,
  });
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

  // SEC: số tiền xác nhận phải khớp đúng số tiền của giao dịch PayOS.
  if (transaction.sessionId) {
    const session = await ParkingSession.findById(transaction.sessionId);
    if (!session) {
      response
        .status(400)
        .json({ message: "Phiên đỗ xe của giao dịch không tồn tại." });
      return;
    }
    const expected = Math.max(
      0,
      (session.fee || 0) - (session.paidAmount || 0),
    );
    if (transaction.amount !== expected) {
      response.status(400).json({
        message: `Số tiền xác nhận (${transaction.amount}) không khớp số còn phải thu (${expected}). Vui lòng kiểm tra lại.`,
      });
      return;
    }
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

export async function payCashForSession(request: Request, response: Response) {
  const body = z
    .object({
      amount: z.number().positive().optional(),
      note: z.string().trim().optional(),
    })
    .parse(request.body ?? {});

  const session = await ParkingSession.findById(request.params.sessionId);
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên đỗ xe." });
    return;
  }

  if (session.fee == null || session.fee <= 0) {
    session.paymentStatus = "fully_paid";
    session.paidAmount = 0;
    await session.save();
    response.json({
      transaction: null,
      sessionPaymentStatus: "fully_paid",
      message: "Phiên không phát sinh phí.",
    });
    return;
  }

  const amountDue = session.fee - (session.paidAmount || 0);
  if (amountDue <= 0) {
    session.paymentStatus = "fully_paid";
    await session.save();
    response.json({
      transaction: null,
      sessionPaymentStatus: "fully_paid",
      message: "Phiên đã thanh toán đủ.",
    });
    return;
  }

  const amount = body.amount ?? amountDue;
  if (amount > amountDue) {
    response.status(400).json({
      message: `Số tiền thu (${amount}) vượt quá số cần thu (${amountDue}).`,
    });
    return;
  }

  const collectorId = objectId(request.user?.id);
  const transaction = await Transaction.create({
    sessionId: session._id,
    userId: session.ownerUserId,
    createdBy: collectorId,
    transactionType: "parking",
    method: "cash",
    amount,
    status: "paid",
    paidAt: new Date(),
    note: body.note || `Thu tiền mặt tại cổng ra - phiên ${String(session._id)}`,
    plate: session.plate,
  });

  // Nguyên tử: $inc paidAmount rồi $set các field còn lại từ doc mới.
  const updated = await ParkingSession.findByIdAndUpdate(
    session._id,
    {
      $inc: { paidAmount: amount },
      $set: {
        paymentMethod: "cash",
        cashNote: body.note || session.cashNote,
        collectedBy: collectorId,
        transactionId: transaction._id,
      },
    },
    { new: true },
  );
  if (!updated) {
    response.status(404).json({ message: "Không tìm thấy phiên đỗ xe." });
    return;
  }

  const paymentStatus =
    (updated.paidAmount || 0) >= (updated.fee || 0) ? "fully_paid" : "partial_paid";
  const finalSession = await ParkingSession.findByIdAndUpdate(
    session._id,
    { $set: { paymentStatus } },
    { new: true },
  );
  if (!finalSession) {
    response.status(404).json({ message: "Không tìm thấy phiên đỗ xe." });
    return;
  }

  session.paidAmount = finalSession.paidAmount;
  session.paymentMethod = finalSession.paymentMethod;
  session.cashNote = finalSession.cashNote;
  session.collectedBy = finalSession.collectedBy;
  session.transactionId = finalSession.transactionId;
  session.paymentStatus = finalSession.paymentStatus;

  await createAuditLog({
    action: "cash_payment",
    entityType: "ParkingSession",
    entityId: session._id,
    performedBy: request.user?.id ?? "",
    changes: {
      new: {
        amount,
        paidAmount: session.paidAmount,
        fee: session.fee,
        paymentStatus: session.paymentStatus,
      },
    },
  });

  response.status(201).json({
    transaction: serializeTransaction(transaction, session),
    sessionPaymentStatus: session.paymentStatus,
    paidAmount: session.paidAmount,
    amountDue: (session.fee || 0) - (session.paidAmount || 0),
    message: "Đã ghi nhận thanh toán tiền mặt.",
  });
}

export async function cancelTransaction(request: Request, response: Response) {
  const transaction = await Transaction.findById(request.params.id);
  if (!transaction) {
    response.status(404).json({ message: "Không tìm thấy giao dịch." });
    return;
  }

  // SEC: ownership check — staff chỉ được hủy giao dịch do chính mình tạo,
  // admin được hủy mọi giao dịch (customer không tới được route này).
  if (
    request.user?.role !== "admin" &&
    transaction.createdBy?.toString() !== request.user?.id
  ) {
    response
      .status(403)
      .json({ message: "Không có quyền hủy giao dịch này." });
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

export async function getTransaction(request: Request, response: Response) {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ message: "Mã giao dịch không hợp lệ." });
    return;
  }

  const transaction = await Transaction.findById(request.params.id);
  if (!transaction) {
    response.status(404).json({ message: "Không tìm thấy giao dịch." });
    return;
  }

  // Khách hàng chỉ xem được giao dịch của mình
  if (
    request.user?.role === "customer" &&
    transaction.userId?.toString() !== request.user.id
  ) {
    response.status(403).json({ message: "Không có quyền xem giao dịch này." });
    return;
  }

  const session = transaction.sessionId
    ? await ParkingSession.findById(transaction.sessionId)
    : null;
  const subscription = transaction.subscriptionId
    ? await Subscription.findById(transaction.subscriptionId)
    : null;

  response.json({
    transaction: serializeTransaction(transaction, session, subscription),
  });
}

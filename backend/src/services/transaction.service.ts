import mongoose from "mongoose";
import { ParkingSessionDocument } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";
import { PaymentConfig } from "../models/PaymentConfig.js";

export async function createPendingTransactionForSession(session: ParkingSessionDocument) {
  // Nếu đã thanh toán đủ (webhook đã xử lý) → không ghi đè
  if (session.paymentStatus === "fully_paid" || (session.paidAmount || 0) >= (session.fee || 0)) {
    return null;
  }

  const existingPending = await Transaction.findOne({
    sessionId: session._id,
    status: "pending",
  });
  if (existingPending) {
    session.transactionId = existingPending._id;
    session.paymentStatus = (session.paidAmount || 0) > 0 ? "partial_paid" : "unpaid";
    return existingPending;
  }

  const amount = session.fee - (session.paidAmount || 0);
  if (amount <= 0) {
    session.paymentStatus = "fully_paid";
    return null;
  }

  const transaction = await Transaction.create({
    sessionId: session._id,
    userId: session.ownerUserId,
    method: "payos",
    amount,
    status: "pending",
  });

  session.transactionId = transaction._id;
  session.paymentStatus = (session.paidAmount || 0) > 0 ? "partial_paid" : "unpaid";
  return transaction;
}

/**
 * Update transaction with PayOS payment link data
 */
export async function updateTransactionWithPayOS(
  transactionId: string,
  payosData: {
    orderCode: string;
    checkoutUrl?: string;
    qrCode?: string;
    paymentLinkId?: string;
  },
) {
  await Transaction.findByIdAndUpdate(transactionId, {
    payosOrderCode: payosData.orderCode,
    payosCheckoutUrl: payosData.checkoutUrl,
    payosQrCode: payosData.qrCode,
    payosPaymentLinkId: payosData.paymentLinkId,
  });
}

export function objectId(value?: string) {
  return value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : undefined;
}

export async function getActivePaymentConfig() {
  const config = await PaymentConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (!config) throw new Error("Payment configuration is not available");
  return config;
}

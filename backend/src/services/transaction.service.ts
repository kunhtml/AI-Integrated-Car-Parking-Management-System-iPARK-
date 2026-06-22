import mongoose from "mongoose";
import { PaymentConfig } from "../models/PaymentConfig.js";
import { ParkingSessionDocument } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";

export async function getActivePaymentConfig() {
  const config = await PaymentConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (config) {
    return config;
  }

  return PaymentConfig.create({
    bankName: "Ngân hàng test",
    bankBin: "970436",
    accountNumber: "0000000000",
    accountName: "IPARK",
    transferPrefix: "IPARK",
    isActive: true,
  });
}

export function buildVietQrUrl(values: {
  bankBin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  content: string;
}) {
  const params = new URLSearchParams({
    amount: String(values.amount),
    addInfo: values.content,
    accountName: values.accountName,
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(values.bankBin)}-${encodeURIComponent(
    values.accountNumber,
  )}-compact2.png?${params.toString()}`;
}

export async function createPendingTransactionForSession(session: ParkingSessionDocument) {
  if (!session.fee) {
    session.paymentStatus = "paid";
    return null;
  }

  const existed = await Transaction.findOne({
    sessionId: session._id,
    status: { $in: ["pending", "paid"] },
  });
  if (existed) {
    session.transactionId = existed._id;
    session.paymentStatus = existed.status === "paid" ? "paid" : "pending";
    return existed;
  }

  const config = await getActivePaymentConfig();
  const content = `${config.transferPrefix}-${session._id.toString()}`;
  const transaction = await Transaction.create({
    sessionId: session._id,
    userId: session.ownerUserId,
    method: "vietqr",
    amount: session.fee,
    status: "pending",
    content,
    qrUrl: buildVietQrUrl({
      bankBin: config.bankBin,
      accountNumber: config.accountNumber,
      accountName: config.accountName,
      amount: session.fee,
      content,
    }),
  });

  session.transactionId = transaction._id;
  session.paymentStatus = "pending";
  return transaction;
}

export function objectId(value?: string) {
  return value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : undefined;
}

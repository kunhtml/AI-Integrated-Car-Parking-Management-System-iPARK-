import { Request, Response } from "express";
import { PaymentConfig } from "../models/PaymentConfig.js";
import { getActivePaymentConfig } from "../services/transaction.service.js";

export async function getPaymentConfig(_request: Request, response: Response) {
  const paymentConfig = await getActivePaymentConfig();
  response.json({
    paymentConfig: {
      id: paymentConfig._id.toString(),
      bankName: paymentConfig.bankName,
      bankBin: paymentConfig.bankBin,
      accountNumber: paymentConfig.accountNumber,
      accountName: paymentConfig.accountName,
      transferPrefix: paymentConfig.transferPrefix,
      isActive: paymentConfig.isActive,
    },
  });
}

export async function updatePaymentConfig(request: Request, response: Response) {
  const body = request.body as Partial<{
    bankName: string;
    bankBin: string;
    accountNumber: string;
    accountName: string;
    transferPrefix: string;
  }>;

  const current = await getActivePaymentConfig();
  const updated = await PaymentConfig.findByIdAndUpdate(
    current._id,
    {
      ...(body.bankName ? { bankName: body.bankName } : {}),
      ...(body.bankBin ? { bankBin: body.bankBin } : {}),
      ...(body.accountNumber ? { accountNumber: body.accountNumber } : {}),
      ...(body.accountName ? { accountName: body.accountName } : {}),
      ...(body.transferPrefix ? { transferPrefix: body.transferPrefix } : {}),
    },
    { new: true },
  );

  response.json({
    paymentConfig: {
      id: updated?._id.toString(),
      bankName: updated?.bankName,
      bankBin: updated?.bankBin,
      accountNumber: updated?.accountNumber,
      accountName: updated?.accountName,
      transferPrefix: updated?.transferPrefix,
      isActive: updated?.isActive,
    },
  });
}

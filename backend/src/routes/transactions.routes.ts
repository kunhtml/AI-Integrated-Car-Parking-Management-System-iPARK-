import { Router } from "express";
import {
  confirmTopUp,
  confirmTransaction,
  createSessionTransaction,
  listTransactions,
  topUpWallet,
} from "../controllers/transactions.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const transactionsRoutes = Router();

// Public checkout endpoint (for public landing page - no auth required)
transactionsRoutes.post("/session/:sessionId", asyncHandler(createSessionTransaction));

// Check PayOS payment by order code
transactionsRoutes.get("/check-payos/:orderCode", asyncHandler(async (req, res) => {
  const { checkPayOSPaymentStatus } = await import("../services/payos.service.js");
  const status = await checkPayOSPaymentStatus(req.params.orderCode);
  res.json(status);
}));

transactionsRoutes.use(requireAuth);
transactionsRoutes.get("/", asyncHandler(listTransactions));
transactionsRoutes.post("/top-up", asyncHandler(topUpWallet));
transactionsRoutes.post("/:id/confirm", requireRole("admin"), asyncHandler(confirmTransaction));
transactionsRoutes.post("/:id/confirm-topup", requireRole("admin"), asyncHandler(confirmTopUp));

import { Router } from "express";
import {
  confirmTransaction,
  createSessionTransaction,
  listTransactions,
} from "../controllers/transactions.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const transactionsRoutes = Router();

transactionsRoutes.use(requireAuth);
transactionsRoutes.get("/", asyncHandler(listTransactions));
transactionsRoutes.post("/session/:sessionId", asyncHandler(createSessionTransaction));
transactionsRoutes.post("/:id/confirm", requireRole("admin"), asyncHandler(confirmTransaction));

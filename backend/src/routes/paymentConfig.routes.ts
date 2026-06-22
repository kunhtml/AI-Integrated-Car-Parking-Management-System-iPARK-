import { Router } from "express";
import { getPaymentConfig, updatePaymentConfig } from "../controllers/paymentConfig.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const paymentConfigRoutes = Router();

paymentConfigRoutes.use(requireAuth);
paymentConfigRoutes.get("/", asyncHandler(getPaymentConfig));
paymentConfigRoutes.put("/", requireRole("admin"), asyncHandler(updatePaymentConfig));

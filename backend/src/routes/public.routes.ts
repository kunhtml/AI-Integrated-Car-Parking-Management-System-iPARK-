import { Router } from "express";
import {
  publicAvailability,
  publicSearch,
  lookupSession,
  calculateExitFee,
  calculateFeeQuick,
  preCheckout,
  confirmPayment,
  extendSession,
  quickLookup,
  checkSessionPaymentStatus,
} from "../controllers/public.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const publicRoutes = Router();

publicRoutes.get("/availability", asyncHandler(publicAvailability));
publicRoutes.get("/search", asyncHandler(publicSearch));
publicRoutes.get("/lookup", asyncHandler(lookupSession));
publicRoutes.post("/calculate-fee", asyncHandler(calculateExitFee));
publicRoutes.post("/calculate-fee-quick", asyncHandler(calculateFeeQuick));
publicRoutes.post("/pre-checkout", asyncHandler(preCheckout));
publicRoutes.post("/confirm-payment", asyncHandler(confirmPayment));
publicRoutes.post("/extend-session", asyncHandler(extendSession));
publicRoutes.get("/quick-lookup", asyncHandler(quickLookup));
publicRoutes.get("/session/:sessionId/payment-status", asyncHandler(checkSessionPaymentStatus));

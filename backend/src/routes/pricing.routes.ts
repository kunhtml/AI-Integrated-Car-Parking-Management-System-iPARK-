import { Router } from "express";
import { getPricingConfig, updatePricingConfig } from "../controllers/pricing.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const pricingRoutes = Router();

pricingRoutes.use(requireAuth, requireRole("admin"));
pricingRoutes.get("/", asyncHandler(getPricingConfig));
pricingRoutes.put("/", asyncHandler(updatePricingConfig));

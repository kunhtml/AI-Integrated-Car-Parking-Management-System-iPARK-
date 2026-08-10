import { Router } from "express";
import { getPricingConfig, updatePricingConfig } from "../controllers/pricingConfig.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const pricingConfigRoutes = Router();

pricingConfigRoutes.use(requireAuth);
pricingConfigRoutes.get("/", asyncHandler(getPricingConfig));
pricingConfigRoutes.patch("/", requireRole("admin"), asyncHandler(updatePricingConfig));

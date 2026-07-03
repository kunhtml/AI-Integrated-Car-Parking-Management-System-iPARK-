import { Router } from "express";
import { getPricingConfig, runAutomatedProcessController, updatePricingConfig } from "../controllers/pricing.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const pricingRoutes = Router();

pricingRoutes.use(requireAuth, requireRole("admin"));
pricingRoutes.get("/", asyncHandler(getPricingConfig));
pricingRoutes.put("/", asyncHandler(updatePricingConfig));
pricingRoutes.post("/auto-process", asyncHandler(runAutomatedProcessController));

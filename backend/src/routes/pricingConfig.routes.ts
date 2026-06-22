import { Router } from "express";
import { getPricingConfig } from "../controllers/pricing.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const pricingConfigRoutes = Router();

pricingConfigRoutes.use(requireAuth);
pricingConfigRoutes.get("/", asyncHandler(getPricingConfig));

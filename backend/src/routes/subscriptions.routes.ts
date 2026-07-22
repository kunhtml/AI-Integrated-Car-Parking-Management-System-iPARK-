import { Router } from "express";
import { listSubscriptions } from "../controllers/subscriptions.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const subscriptionsRoutes = Router();

subscriptionsRoutes.use(requireAuth);
subscriptionsRoutes.get(
  "/",
  requireRole("admin", "staff", "customer"),
  asyncHandler(listSubscriptions),
);

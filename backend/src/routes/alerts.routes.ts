import { Router } from "express";
import {
  getCapacityStatusHandler,
  checkAlertsHandler,
} from "../controllers/alerts.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const alertsRoutes = Router();

alertsRoutes.use(requireAuth);

alertsRoutes.get("/capacity", asyncHandler(getCapacityStatusHandler));
alertsRoutes.post("/check", requireRole("admin"), asyncHandler(checkAlertsHandler));

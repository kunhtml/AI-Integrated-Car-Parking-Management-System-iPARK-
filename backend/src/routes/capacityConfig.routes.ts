import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getCapacityConfigHandler,
  getCapacityHistoryHandler,
  getCapacityUsageHandler,
  getZoneSlotsHandler,
  updateGlobalCapacityHandler,
  updateZoneCapacityHandler,
} from "../controllers/capacityConfig.controller.js";

export const capacityConfigRoutes = Router();

capacityConfigRoutes.use(requireAuth);

capacityConfigRoutes.get("/", asyncHandler(getCapacityConfigHandler));
capacityConfigRoutes.get("/usage", asyncHandler(getCapacityUsageHandler));
capacityConfigRoutes.get("/slots", asyncHandler(getZoneSlotsHandler));
capacityConfigRoutes.get("/history", requireRole("admin"), asyncHandler(getCapacityHistoryHandler));
capacityConfigRoutes.put("/global", requireRole("admin"), asyncHandler(updateGlobalCapacityHandler));
capacityConfigRoutes.put("/zones/:id", requireRole("admin"), asyncHandler(updateZoneCapacityHandler));

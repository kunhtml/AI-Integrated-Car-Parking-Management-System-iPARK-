import { Router } from "express";
import {
  createDevice,
  createDeviceMaintenanceHandler,
  deviceHealthHandler,
  healthCheckHandler,
  listDeviceMaintenanceHandler,
  listDevices,
  restartDeviceHandler,
  snapshotDevice,
  updateDevice,
  updateScheduleHandler,
} from "../controllers/devices.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const devicesRoutes = Router();

devicesRoutes.use(requireAuth, requireRole("admin", "staff"));
devicesRoutes.get("/", asyncHandler(listDevices));
devicesRoutes.get("/health", asyncHandler(deviceHealthHandler));
devicesRoutes.post("/health-check", requireRole("admin"), asyncHandler(healthCheckHandler));
devicesRoutes.post("/", requireRole("admin"), asyncHandler(createDevice));
devicesRoutes.patch("/:id", requireRole("admin"), asyncHandler(updateDevice));
devicesRoutes.patch("/:id/schedule", requireRole("admin"), asyncHandler(updateScheduleHandler));
devicesRoutes.post("/:id/snapshot", asyncHandler(snapshotDevice));
devicesRoutes.post("/:id/restart", requireRole("admin"), asyncHandler(restartDeviceHandler));
devicesRoutes.get("/:id/maintenance", asyncHandler(listDeviceMaintenanceHandler));
devicesRoutes.post("/:id/maintenance", requireRole("admin"), asyncHandler(createDeviceMaintenanceHandler));

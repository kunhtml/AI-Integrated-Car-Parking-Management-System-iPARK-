import { Router } from "express";
import {
  createDevice,
  deleteDevice,
  getLaneRoles,
  createDeviceMaintenanceHandler,
  deviceHealthHandler,
  healthCheckHandler,
  listDeviceMaintenanceHandler,
  listDevices,
  restartDeviceHandler,
  snapshotDevice,
  updateDevice,
  swapCameraRoles,
  updateDeviceRoi,
  updateScheduleHandler,
} from "../controllers/devices.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const devicesRoutes = Router();

devicesRoutes.use(requireAuth, requireRole("admin", "staff"));
devicesRoutes.get("/", asyncHandler(listDevices));
devicesRoutes.get("/lane-roles", asyncHandler(getLaneRoles));
devicesRoutes.get("/health", asyncHandler(deviceHealthHandler));
devicesRoutes.post("/health-check", requireRole("admin"), asyncHandler(healthCheckHandler));
devicesRoutes.post("/swap-roles", requireRole("admin"), asyncHandler(swapCameraRoles));
devicesRoutes.post("/", requireRole("admin"), asyncHandler(createDevice));
devicesRoutes.patch("/:id", requireRole("admin"), asyncHandler(updateDevice));
devicesRoutes.delete("/:id", requireRole("admin"), asyncHandler(deleteDevice));
devicesRoutes.patch("/:id/roi", requireRole("admin"), asyncHandler(updateDeviceRoi));
devicesRoutes.patch("/:id/schedule", requireRole("admin"), asyncHandler(updateScheduleHandler));
devicesRoutes.post("/:id/snapshot", asyncHandler(snapshotDevice));
devicesRoutes.post("/:id/restart", requireRole("admin"), asyncHandler(restartDeviceHandler));
devicesRoutes.get("/:id/maintenance", asyncHandler(listDeviceMaintenanceHandler));
devicesRoutes.post("/:id/maintenance", requireRole("admin"), asyncHandler(createDeviceMaintenanceHandler));

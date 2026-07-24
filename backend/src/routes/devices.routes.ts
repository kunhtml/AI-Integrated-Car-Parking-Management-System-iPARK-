import { Router } from "express";
import {
  listDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  snapshotDevice,
  connectDeviceHandler,
  configureRoiHandler,
  getRoiConfigHandler,
  streamDeviceHandler,
  captureDeviceImageHandler,
  restartDeviceHandler,
  listDeviceMaintenanceHandler,
  createDeviceMaintenanceHandler,
  deviceHealthHandler,
  healthCheckHandler,
  updateScheduleHandler,
  toggleAutoScanHandler,
  updateAutoScanIntervalHandler,
  getAutoScanStatusHandler,
} from "../controllers/devices.controller.js";
import { onvifMotionEventHandler } from "../controllers/cameras.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const devicesRoutes = Router();

// ONVIF motion webhook - camera khong co token auth
devicesRoutes.post("/:id/motion", asyncHandler(onvifMotionEventHandler));

devicesRoutes.use(requireAuth, requireRole("admin", "staff"));

// Static paths truoc :id
devicesRoutes.get("/", asyncHandler(listDevices));
devicesRoutes.get("/health", asyncHandler(deviceHealthHandler));
devicesRoutes.post("/health-check", requireRole("admin"), asyncHandler(healthCheckHandler));
devicesRoutes.get("/auto-scan/status", asyncHandler(getAutoScanStatusHandler));

devicesRoutes.post("/", requireRole("admin"), asyncHandler(createDevice));
devicesRoutes.patch("/:id", requireRole("admin"), asyncHandler(updateDevice));
devicesRoutes.delete("/:id", requireRole("admin"), asyncHandler(deleteDevice));

devicesRoutes.post("/:id/snapshot", asyncHandler(snapshotDevice));
devicesRoutes.post("/:id/connect", asyncHandler(connectDeviceHandler));
devicesRoutes.post("/:id/capture", asyncHandler(captureDeviceImageHandler));
devicesRoutes.get("/:id/stream", asyncHandler(streamDeviceHandler));
devicesRoutes.post("/:id/restart", requireRole("admin"), asyncHandler(restartDeviceHandler));

devicesRoutes.get("/:id/roi", asyncHandler(getRoiConfigHandler));
devicesRoutes.patch("/:id/roi", asyncHandler(configureRoiHandler));

devicesRoutes.post("/:id/auto-scan", requireRole("admin"), asyncHandler(toggleAutoScanHandler));
devicesRoutes.patch("/:id/auto-scan/interval", requireRole("admin"), asyncHandler(updateAutoScanIntervalHandler));

devicesRoutes.get("/:id/maintenance", asyncHandler(listDeviceMaintenanceHandler));
devicesRoutes.post("/:id/maintenance", requireRole("admin"), asyncHandler(createDeviceMaintenanceHandler));
devicesRoutes.patch("/:id/schedule", requireRole("admin"), asyncHandler(updateScheduleHandler));
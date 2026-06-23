import { Router } from "express";
import {
  listDevices,
  saveDevice,
  snapshotDevice,
  deleteDevice,
} from "../controllers/devices.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const devicesRoutes = Router();

devicesRoutes.use(requireAuth, requireRole("admin", "staff"));
devicesRoutes.get("/", asyncHandler(listDevices));
devicesRoutes.post("/", asyncHandler(saveDevice));
devicesRoutes.post("/:id/snapshot", asyncHandler(snapshotDevice));
devicesRoutes.delete("/:id", asyncHandler(deleteDevice));

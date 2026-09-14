import { Router } from "express";
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  getVehicleHistory,
  listVehicles,
  resubmitVehicle,
  updateVehicle,
} from "../controllers/vehicles.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const vehiclesRoutes = Router();

vehiclesRoutes.use(requireAuth);
vehiclesRoutes.get("/", asyncHandler(listVehicles));
vehiclesRoutes.get("/:id/history", asyncHandler(getVehicleHistory));
vehiclesRoutes.get("/:id", asyncHandler(getVehicle));
vehiclesRoutes.post("/", asyncHandler(createVehicle));
vehiclesRoutes.post("/:id/resubmit", asyncHandler(resubmitVehicle));
vehiclesRoutes.patch("/:id", asyncHandler(updateVehicle));
vehiclesRoutes.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(deleteVehicle),
);

import { Router } from "express";
import { createVehicle, deleteVehicle, getVehicle, listVehicles, updateVehicle } from "../controllers/vehicles.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const vehiclesRoutes = Router();

vehiclesRoutes.use(requireAuth);
vehiclesRoutes.get("/", asyncHandler(listVehicles));
vehiclesRoutes.get("/:id", asyncHandler(getVehicle));
vehiclesRoutes.post("/", asyncHandler(createVehicle));
vehiclesRoutes.patch("/:id", requireRole("admin"), asyncHandler(updateVehicle));
vehiclesRoutes.delete("/:id", requireRole("admin"), asyncHandler(deleteVehicle));

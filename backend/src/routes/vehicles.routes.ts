import { Router } from "express";
import { createVehicle, listVehicles, updateVehicle } from "../controllers/vehicles.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const vehiclesRoutes = Router();

vehiclesRoutes.use(requireAuth);
vehiclesRoutes.get("/", asyncHandler(listVehicles));
vehiclesRoutes.post("/", asyncHandler(createVehicle));
vehiclesRoutes.patch("/", requireRole("admin"), asyncHandler(updateVehicle));

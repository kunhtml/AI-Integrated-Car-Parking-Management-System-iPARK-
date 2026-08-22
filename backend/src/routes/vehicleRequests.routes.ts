import { Router } from "express";
import { createVehicleRequest, listVehicleRequests, resolveVehicleRequest } from "../controllers/vehicleRequests.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const vehicleRequestsRoutes = Router();

vehicleRequestsRoutes.use(requireAuth);
vehicleRequestsRoutes.get("/", asyncHandler(listVehicleRequests));
vehicleRequestsRoutes.post("/", requireRole("customer"), asyncHandler(createVehicleRequest));
vehicleRequestsRoutes.patch("/:id/resolve", requireRole("admin"), asyncHandler(resolveVehicleRequest));

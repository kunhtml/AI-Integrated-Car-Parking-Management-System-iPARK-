import { Router } from "express";
import {
  assistedRegisterSession,
  assistedRegisterVehicle,
} from "../controllers/assistedRegistration.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const assistedRegistrationRoutes = Router();

assistedRegistrationRoutes.use(requireAuth, requireRole("admin", "staff"));

assistedRegistrationRoutes.post("/session", asyncHandler(assistedRegisterSession));
assistedRegistrationRoutes.post("/vehicle", asyncHandler(assistedRegisterVehicle));

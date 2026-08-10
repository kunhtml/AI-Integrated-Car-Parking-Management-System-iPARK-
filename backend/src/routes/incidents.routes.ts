import { Router } from "express";
import { createIncident, listIncidents, updateIncident } from "../controllers/incidents.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const incidentsRoutes = Router();

incidentsRoutes.use(requireAuth, requireRole("admin", "staff"));
incidentsRoutes.get("/", asyncHandler(listIncidents));
incidentsRoutes.post("/", asyncHandler(createIncident));
incidentsRoutes.patch("/:id", requireRole("admin"), asyncHandler(updateIncident));

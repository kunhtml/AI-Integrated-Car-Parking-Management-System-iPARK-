import { Router } from "express";
import { overviewSessions, listSessions, updateSession } from "../controllers/parkingSessions.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

export const parkingSessionsRoutes = Router();

parkingSessionsRoutes.use(requireAuth);
parkingSessionsRoutes.get("/overview", asyncHandler(overviewSessions));
parkingSessionsRoutes.get("/", asyncHandler(listSessions));
parkingSessionsRoutes.patch("/:id", requireRole("admin"), asyncHandler(updateSession));

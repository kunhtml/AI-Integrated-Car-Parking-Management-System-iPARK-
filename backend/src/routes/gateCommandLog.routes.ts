import { Router } from "express";
import { listGateCommandLogsHandler } from "../controllers/gateCommandLog.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const gateCommandLogRoutes = Router();

gateCommandLogRoutes.use(requireAuth, requireRole("admin"));
gateCommandLogRoutes.get("/", asyncHandler(listGateCommandLogsHandler));

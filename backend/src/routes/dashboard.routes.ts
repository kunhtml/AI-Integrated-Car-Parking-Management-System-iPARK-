import { Router } from "express";
import { getDashboardOverview } from "../controllers/dashboard.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth);
dashboardRoutes.get("/overview", requireRole("admin", "staff"), asyncHandler(getDashboardOverview));

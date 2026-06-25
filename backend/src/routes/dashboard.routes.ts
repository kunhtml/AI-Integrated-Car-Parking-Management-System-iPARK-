import { Router } from "express";
import {
  getDashboardOverview,
  getPublicOverview,
  getPublicPricing,
} from "../controllers/dashboard.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const dashboardRoutes = Router();

// Public – dùng cho trang chủ, không cần đăng nhập
dashboardRoutes.get("/public-overview", asyncHandler(getPublicOverview));
dashboardRoutes.get("/public-pricing", asyncHandler(getPublicPricing));

dashboardRoutes.use(requireAuth);
dashboardRoutes.get(
  "/overview",
  requireRole("admin", "staff"),
  asyncHandler(getDashboardOverview),
);

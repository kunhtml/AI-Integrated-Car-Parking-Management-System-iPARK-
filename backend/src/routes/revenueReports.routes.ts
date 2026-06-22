import { Router } from "express";
import { createRevenueReportExport, getRevenueReport } from "../controllers/revenueReports.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const revenueReportsRoutes = Router();

revenueReportsRoutes.use(requireAuth, requireRole("admin", "staff"));
revenueReportsRoutes.get("/", asyncHandler(getRevenueReport));
revenueReportsRoutes.post("/exports", asyncHandler(createRevenueReportExport));

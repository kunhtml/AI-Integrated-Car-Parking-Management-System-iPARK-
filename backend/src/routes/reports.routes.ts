import { Router } from "express";
import {
  entryByZoneHandler,
  exitByZoneHandler,
  exportReport,
  getReportSummary,
  occupancyHourlyHandler,
  peakHoursHandler,
  penaltyReportHandler,
  revenueChartHandler,
  topCustomersHandler,
  walletReportHandler,
} from "../controllers/reports.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const reportsRoutes = Router();

reportsRoutes.use(requireAuth, requireRole("admin"));
reportsRoutes.get("/summary", asyncHandler(getReportSummary));
reportsRoutes.get("/export", asyncHandler(exportReport));
reportsRoutes.get("/revenue-chart", asyncHandler(revenueChartHandler));
reportsRoutes.get("/occupancy-hourly", asyncHandler(occupancyHourlyHandler));
reportsRoutes.get("/top-customers", asyncHandler(topCustomersHandler));
reportsRoutes.get("/peak-hours", asyncHandler(peakHoursHandler));

reportsRoutes.get("/entry-by-zone", asyncHandler(entryByZoneHandler));
reportsRoutes.get("/exit-by-zone", asyncHandler(exitByZoneHandler));
reportsRoutes.get("/penalty", asyncHandler(penaltyReportHandler));
reportsRoutes.get("/wallet", asyncHandler(walletReportHandler));

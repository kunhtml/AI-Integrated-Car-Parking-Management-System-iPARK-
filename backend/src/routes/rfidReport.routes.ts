import { Router } from "express";
import {
  getRfidStatusReport,
  getRfidUsageReport,
  exportRfidReport,
} from "../controllers/rfidReport.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const rfidReportRoutes = Router();

rfidReportRoutes.use(requireAuth, requireRole("admin", "staff"));

rfidReportRoutes.get("/status", asyncHandler(getRfidStatusReport));
rfidReportRoutes.get("/usage", asyncHandler(getRfidUsageReport));
rfidReportRoutes.get("/export", asyncHandler(exportRfidReport));

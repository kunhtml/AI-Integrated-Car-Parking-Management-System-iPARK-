import { Router } from "express";
import {
  listAuditLogsHandler,
  getAuditLogStatsHandler,
} from "../controllers/auditLog.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const auditLogRoutes = Router();

auditLogRoutes.use(requireAuth, requireRole("admin"));

auditLogRoutes.get("/", asyncHandler(listAuditLogsHandler));
auditLogRoutes.get("/stats", asyncHandler(getAuditLogStatsHandler));

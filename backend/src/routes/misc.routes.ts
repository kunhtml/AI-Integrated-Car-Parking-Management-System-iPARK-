import { Router } from "express";
import {
  createFeedback,
  createIncident,
  endShift,
  getReportSummary,
  listFeedback,
  listIncidents,
  listNotifications,
  listShifts,
  markNotificationRead,
  resolveIncident,
  startShift,
  updateFeedbackStatus,
} from "../controllers/misc.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const notificationsRoutes = Router();
notificationsRoutes.use(requireAuth);
notificationsRoutes.get("/", asyncHandler(listNotifications));
notificationsRoutes.post("/:id/read", asyncHandler(markNotificationRead));

export const feedbackRoutes = Router();
feedbackRoutes.use(requireAuth);
feedbackRoutes.get("/", asyncHandler(listFeedback));
feedbackRoutes.post("/", asyncHandler(createFeedback));
feedbackRoutes.post("/:id/status", requireRole("admin"), asyncHandler(updateFeedbackStatus));

export const shiftsRoutes = Router();
shiftsRoutes.use(requireAuth, requireRole("admin", "staff"));
shiftsRoutes.get("/", asyncHandler(listShifts));
shiftsRoutes.post("/", asyncHandler(startShift));
shiftsRoutes.post("/:id/end", asyncHandler(endShift));

export const incidentsRoutes = Router();
incidentsRoutes.use(requireAuth, requireRole("admin", "staff"));
incidentsRoutes.get("/", asyncHandler(listIncidents));
incidentsRoutes.post("/", asyncHandler(createIncident));
incidentsRoutes.post("/:id/resolve", asyncHandler(resolveIncident));

export const reportsRoutes = Router();
reportsRoutes.use(requireAuth, requireRole("admin", "staff"));
reportsRoutes.get("/summary", asyncHandler(getReportSummary));

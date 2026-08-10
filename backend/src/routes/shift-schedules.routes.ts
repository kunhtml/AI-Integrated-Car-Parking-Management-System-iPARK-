import { Router } from "express";
import {
  bulkCreateShiftSchedules,
  checkInShift,
  completeShift,
  createShiftSchedule,
  deleteShiftSchedule,
  getMySchedule,
  getShiftStats,
  getShiftTypes,
  getStaffsForSchedule,
  getWeeklySchedule,
  listShiftSchedules,
  updateShiftSchedule,
} from "../controllers/shift-schedules.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const shiftScheduleRoutes = Router();

// Public routes (require auth only)
shiftScheduleRoutes.use(requireAuth);

// GET /api/shift-schedules/types - Get shift types (all authenticated users)
shiftScheduleRoutes.get("/types", asyncHandler(getShiftTypes));

// Staff can see their own schedule
shiftScheduleRoutes.get("/my", asyncHandler(getMySchedule));
shiftScheduleRoutes.get("/week", asyncHandler(getWeeklySchedule));

// Admin only routes
shiftScheduleRoutes.get("/staffs", requireRole("admin"), asyncHandler(getStaffsForSchedule));
shiftScheduleRoutes.get("/stats", requireRole("admin"), asyncHandler(getShiftStats));
shiftScheduleRoutes.get("/", requireRole("admin"), asyncHandler(listShiftSchedules));
shiftScheduleRoutes.post("/bulk", requireRole("admin"), asyncHandler(bulkCreateShiftSchedules));

// Routes for both admin and staff
shiftScheduleRoutes.post("/", asyncHandler(createShiftSchedule));
shiftScheduleRoutes.patch("/:id", asyncHandler(updateShiftSchedule));
shiftScheduleRoutes.delete("/:id", asyncHandler(deleteShiftSchedule));
shiftScheduleRoutes.post("/:id/check-in", asyncHandler(checkInShift));
shiftScheduleRoutes.post("/:id/complete", asyncHandler(completeShift));

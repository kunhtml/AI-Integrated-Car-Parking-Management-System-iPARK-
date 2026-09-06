import { Router } from "express";
import {
  bulkCreateShiftSchedules,
  checkInShift,
  completeShift,
  createShiftSchedule,
  deleteShiftSchedule,
  getMySchedule,
  getMyCurrentShift,
  getScheduleHistory,
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
shiftScheduleRoutes.get("/my/current", asyncHandler(getMyCurrentShift));
// SEC-02: customer không được đọc lịch nhân sự qua /week.
shiftScheduleRoutes.get(
  "/week",
  requireRole("admin", "manager", "staff"),
  asyncHandler(getWeeklySchedule),
);

// Management routes for admin + manager
shiftScheduleRoutes.get(
  "/staffs",
  requireRole("admin", "manager"),
  asyncHandler(getStaffsForSchedule),
);
shiftScheduleRoutes.get(
  "/stats",
  requireRole("admin", "manager"),
  asyncHandler(getShiftStats),
);
shiftScheduleRoutes.get(
  "/",
  requireRole("admin", "manager"),
  asyncHandler(listShiftSchedules),
);
shiftScheduleRoutes.post(
  "/bulk",
  requireRole("admin", "manager"),
  asyncHandler(bulkCreateShiftSchedules),
);

// Routes for both admin and manager, plus staff actions
shiftScheduleRoutes.get(
  "/:id/history",
  requireRole("admin", "manager", "staff"),
  asyncHandler(getScheduleHistory),
);
shiftScheduleRoutes.post("/", asyncHandler(createShiftSchedule));
shiftScheduleRoutes.patch("/:id", asyncHandler(updateShiftSchedule));
shiftScheduleRoutes.delete("/:id", asyncHandler(deleteShiftSchedule));
shiftScheduleRoutes.post("/:id/check-in", asyncHandler(checkInShift));
shiftScheduleRoutes.post("/:id/complete", asyncHandler(completeShift));

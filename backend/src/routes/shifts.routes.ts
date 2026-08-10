import { Router } from "express";
import { endShift, listShifts, startShift, submitShiftReport } from "../controllers/shifts.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const shiftsRoutes = Router();

shiftsRoutes.use(requireAuth, requireRole("admin", "staff"));
shiftsRoutes.get("/", asyncHandler(listShifts));
shiftsRoutes.post("/", asyncHandler(startShift));
shiftsRoutes.patch("/:id/end", asyncHandler(endShift));
shiftsRoutes.post("/:id/report", asyncHandler(submitShiftReport));

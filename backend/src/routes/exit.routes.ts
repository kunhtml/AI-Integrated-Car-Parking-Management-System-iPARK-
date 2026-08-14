import { Router } from "express";
import {
  verifyExit,
  openGate,
  getPendingExit,
  resolveExitMismatch,
} from "../controllers/exit.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const exitRoutes = Router();

exitRoutes.get("/pending", getPendingExit);
exitRoutes.post("/verify", verifyExit);
exitRoutes.post("/open-gate", openGate);
exitRoutes.post(
  "/resolve-mismatch",
  requireAuth,
  requireRole("admin", "staff"),
  asyncHandler(resolveExitMismatch),
);

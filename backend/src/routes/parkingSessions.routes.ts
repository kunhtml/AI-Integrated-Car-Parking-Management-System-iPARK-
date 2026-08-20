import { Router } from "express";
import {
  approveCheckout,
  cameraEntry,
  completeParkingSession,
  createParkingSession,
  downloadSessionReceiptHandler,
  getSessionReceiptHandler,
  listParkingSessions,
  requestVerification,
  scanOverdueHandler,
  waivePenaltyHandler,
} from "../controllers/parkingSessions.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const parkingSessionsRoutes = Router();

parkingSessionsRoutes.use(requireAuth);
parkingSessionsRoutes.get("/", asyncHandler(listParkingSessions));
parkingSessionsRoutes.post("/", requireRole("staff"), asyncHandler(createParkingSession));
parkingSessionsRoutes.patch("/", requireRole("staff"), asyncHandler(completeParkingSession));
parkingSessionsRoutes.post("/camera-entry", requireRole("staff"), asyncHandler(cameraEntry));
parkingSessionsRoutes.post(
  "/:id/verification-request",
  requireRole("admin", "staff"),
  asyncHandler(requestVerification),
);
parkingSessionsRoutes.post("/:id/approve-checkout", requireRole("admin"), asyncHandler(approveCheckout));
parkingSessionsRoutes.post("/scan-overdue", requireRole("admin"), asyncHandler(scanOverdueHandler));
parkingSessionsRoutes.post("/:id/waive-penalty", requireRole("admin", "staff"), asyncHandler(waivePenaltyHandler));
parkingSessionsRoutes.get("/:id/receipt", asyncHandler(getSessionReceiptHandler));
parkingSessionsRoutes.get("/:id/receipt/pdf", asyncHandler(downloadSessionReceiptHandler));

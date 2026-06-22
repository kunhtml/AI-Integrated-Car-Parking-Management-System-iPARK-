import { Router } from "express";
import {
  approveCheckout,
  cameraEntry,
  cameraExit,
  completeParkingSession,
  createParkingSession,
  listParkingSessions,
  requestVerification,
  uploadParkingImage,
} from "../controllers/parkingSessions.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { imageUpload } from "../middlewares/upload.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const parkingSessionsRoutes = Router();

parkingSessionsRoutes.use(requireAuth);
parkingSessionsRoutes.get("/", asyncHandler(listParkingSessions));
parkingSessionsRoutes.post("/", requireRole("admin", "staff"), asyncHandler(createParkingSession));
parkingSessionsRoutes.patch("/", requireRole("admin", "staff"), asyncHandler(completeParkingSession));
parkingSessionsRoutes.post("/camera-entry", requireRole("admin", "staff"), asyncHandler(cameraEntry));
parkingSessionsRoutes.post("/camera-exit", requireRole("admin", "staff"), asyncHandler(cameraExit));
parkingSessionsRoutes.post(
  "/upload",
  requireRole("admin", "staff"),
  imageUpload.single("image"),
  asyncHandler(uploadParkingImage),
);
parkingSessionsRoutes.post(
  "/:id/verification-request",
  requireRole("admin", "staff"),
  asyncHandler(requestVerification),
);
parkingSessionsRoutes.post("/:id/approve-checkout", requireRole("admin"), asyncHandler(approveCheckout));

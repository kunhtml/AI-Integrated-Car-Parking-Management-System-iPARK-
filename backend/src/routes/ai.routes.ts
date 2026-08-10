import { Router } from "express";
import {
  detectOccupancyHandler,
  detectStraddleHandler,
  suggestDividersHandler,
  detectCarsHandler,
  listAiDevicesHandler,
  getDeviceDividersHandler,
  saveDeviceDividersHandler,
  listAiZonesHandler,
  getZoneConfigHandler,
  saveZoneConfigHandler,
  getZoneSlotsHandler,
  saveZoneSlotsHandler,
  scanZoneViolationsHandler,
} from "../controllers/ai.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { imageUpload } from "../middlewares/upload.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const aiRoutes = Router();

aiRoutes.use(requireAuth, requireRole("admin", "staff"));
aiRoutes.post(
  "/detect-occupancy",
  imageUpload.single("image"),
  asyncHandler(detectOccupancyHandler),
);
aiRoutes.post(
  "/detect-straddle",
  imageUpload.single("image"),
  asyncHandler(detectStraddleHandler),
);
aiRoutes.post(
  "/suggest-dividers",
  imageUpload.single("image"),
  asyncHandler(suggestDividersHandler),
);
aiRoutes.post(
  "/detect-cars",
  imageUpload.single("image"),
  asyncHandler(detectCarsHandler),
);
aiRoutes.get("/devices", asyncHandler(listAiDevicesHandler));
aiRoutes.get("/devices/:id/dividers", asyncHandler(getDeviceDividersHandler));
aiRoutes.put("/devices/:id/dividers", asyncHandler(saveDeviceDividersHandler));

// Cấu hình AI theo khu vực đỗ (Zone A/B/C...)
aiRoutes.get("/zones", asyncHandler(listAiZonesHandler));
aiRoutes.get("/zones/:id/config", asyncHandler(getZoneConfigHandler));
aiRoutes.put("/zones/:id/config", asyncHandler(saveZoneConfigHandler));
aiRoutes.get("/zones/:id/slots", asyncHandler(getZoneSlotsHandler));
aiRoutes.put("/zones/:id/slots", asyncHandler(saveZoneSlotsHandler));
aiRoutes.post(
  "/zones/:id/scan-violations",
  imageUpload.single("image"),
  asyncHandler(scanZoneViolationsHandler),
);

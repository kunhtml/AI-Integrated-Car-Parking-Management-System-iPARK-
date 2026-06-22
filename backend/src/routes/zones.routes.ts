import { Router } from "express";
import {
  createZoneHandler,
  deleteZoneHandler,
  getZoneHandler,
  listZonesHandler,
  updateZoneHandler,
} from "../controllers/zones.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const zonesRoutes = Router();

zonesRoutes.get("/", requireAuth, asyncHandler(listZonesHandler));
zonesRoutes.get("/:id", requireAuth, requireRole("admin", "staff"), asyncHandler(getZoneHandler));
zonesRoutes.post("/", requireAuth, requireRole("admin"), asyncHandler(createZoneHandler));
zonesRoutes.put("/:id", requireAuth, requireRole("admin"), asyncHandler(updateZoneHandler));
zonesRoutes.delete("/:id", requireAuth, requireRole("admin"), asyncHandler(deleteZoneHandler));

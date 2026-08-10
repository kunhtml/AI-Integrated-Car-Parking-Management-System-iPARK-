import { Router } from "express";
import {
  createZoneHandler,
  deleteZoneHandler,
  getZoneHandler,
  listZonesHandler,
  updateZoneHandler,
} from "../controllers/zones.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

export const zonesRoutes = Router();

zonesRoutes.get("/", requireAuth, listZonesHandler);
zonesRoutes.get("/:id", requireAuth, requireRole("admin", "staff"), getZoneHandler);
zonesRoutes.post("/", requireAuth, requireRole("admin"), createZoneHandler);
zonesRoutes.put("/:id", requireAuth, requireRole("admin"), updateZoneHandler);
zonesRoutes.delete("/:id", requireAuth, requireRole("admin"), deleteZoneHandler);

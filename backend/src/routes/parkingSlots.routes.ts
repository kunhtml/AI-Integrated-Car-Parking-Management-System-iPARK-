import { Router } from "express";
import {
  bulkCreateSlotsHandler,
  createParkingSlotHandler,
  deleteParkingSlotHandler,
  getSlotMapHandler,
  listParkingSlotsHandler,
  updateParkingSlotHandler,
  updateSlotStatusHandler,
} from "../controllers/parkingSlots.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

export const parkingSlotsRoutes = Router();

// NOTE: /map must be declared before /:id to avoid being matched as an id
parkingSlotsRoutes.get("/", requireAuth, requireRole("admin", "staff"), listParkingSlotsHandler);
parkingSlotsRoutes.get("/map", requireAuth, requireRole("admin", "staff"), getSlotMapHandler);
parkingSlotsRoutes.post("/bulk", requireAuth, requireRole("admin"), bulkCreateSlotsHandler);
parkingSlotsRoutes.post("/", requireAuth, requireRole("admin"), createParkingSlotHandler);
parkingSlotsRoutes.put("/:id", requireAuth, requireRole("admin"), updateParkingSlotHandler);
parkingSlotsRoutes.patch("/:id", requireAuth, requireRole("admin"), updateParkingSlotHandler);
parkingSlotsRoutes.delete("/:id", requireAuth, requireRole("admin"), deleteParkingSlotHandler);
parkingSlotsRoutes.patch("/:id/status", requireAuth, requireRole("admin", "staff"), updateSlotStatusHandler);

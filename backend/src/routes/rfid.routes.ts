import { Router } from "express";
import {
  createRfidCard,
  deleteRfidCard,
  exportAllCards,
  getRfidCard,
  listMyRfidCards,
  listRfidCards,
  listUnassignedResidents,
  lookupByPlate,
  lookupRfidCardByUid,
  registerScannedCard,
  setRfidCardStatus,
  updateRfidCard,
} from "../controllers/rfid.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireServiceToken } from "../middlewares/service-auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const rfidRoutes = Router();

// Admin/staff CRUD dùng session auth
rfidRoutes.use(requireAuth);
rfidRoutes.get("/mine", asyncHandler(listMyRfidCards));
rfidRoutes.get("/", requireRole("admin", "staff"), asyncHandler(listRfidCards));
rfidRoutes.get("/unassigned-residents", requireRole("admin", "staff"), asyncHandler(listUnassignedResidents));
rfidRoutes.post("/", requireRole("admin", "staff"), asyncHandler(createRfidCard));
rfidRoutes.get("/:id", requireRole("admin", "staff"), asyncHandler(getRfidCard));
rfidRoutes.patch("/:id", requireRole("admin", "staff"), asyncHandler(updateRfidCard));
rfidRoutes.delete("/:id", requireRole("admin", "staff"), asyncHandler(deleteRfidCard));
rfidRoutes.post("/:id/status", requireRole("admin", "staff"), asyncHandler(setRfidCardStatus));

// Bridge endpoints dùng service token (Python service)
const bridgeRfid = Router();
bridgeRfid.use(requireServiceToken);
bridgeRfid.get("/lookup/:uid", asyncHandler(lookupRfidCardByUid));
bridgeRfid.get("/by-plate/:plate", asyncHandler(lookupByPlate));
bridgeRfid.post("/scan", asyncHandler(registerScannedCard));
bridgeRfid.get("/export", asyncHandler(exportAllCards));

export { bridgeRfid };
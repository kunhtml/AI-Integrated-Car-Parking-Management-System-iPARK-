import { Router } from "express";
import {
  registerRfid,
  listRfidCards,
  getRfidCardDetail,
  updateRfidStatus,
  assignRfidCard,
  returnRfidCard,
  scanRfidEntry,
  scanRfidExit,
  confirmExitRfid,
  reportLostCard,
  unblockCard,
  listScanLogs,
  getCardHistory,
} from "../controllers/rfid.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const rfidRoutes = Router();

rfidRoutes.use(requireAuth, requireRole("admin", "staff"));

// CRUD
rfidRoutes.get("/", asyncHandler(listRfidCards));
rfidRoutes.post("/", requireRole("admin"), asyncHandler(registerRfid));
rfidRoutes.get("/scan-logs", asyncHandler(listScanLogs));
rfidRoutes.get("/:id", asyncHandler(getRfidCardDetail));
rfidRoutes.patch("/:id/status", requireRole("admin"), asyncHandler(updateRfidStatus));
rfidRoutes.post("/:id/report-lost", asyncHandler(reportLostCard));
rfidRoutes.post("/:id/unblock", requireRole("admin"), asyncHandler(unblockCard));
rfidRoutes.get("/:id/history", asyncHandler(getCardHistory));

// Scan operations
rfidRoutes.post("/scan/entry", asyncHandler(scanRfidEntry));
rfidRoutes.post("/scan/exit", asyncHandler(scanRfidExit));
rfidRoutes.post("/confirm-exit", asyncHandler(confirmExitRfid));

// Assign / Return
rfidRoutes.post("/assign", asyncHandler(assignRfidCard));
rfidRoutes.post("/return", asyncHandler(returnRfidCard));

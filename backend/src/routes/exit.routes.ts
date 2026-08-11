import { Router } from "express";
import {
  verifyExit,
  openGate,
  getPendingExit,
} from "../controllers/exit.controller.js";

export const exitRoutes = Router();

// GET /api/exit/pending — Lấy phiên xe ra đang chờ RFID (để restore UI khi mount)
exitRoutes.get("/pending", getPendingExit);

// POST /api/exit/verify — Verify RFID + xác định amountDue + canOpenGate
exitRoutes.post("/verify", verifyExit);

// POST /api/exit/open-gate — Gate authorize + mở barie
exitRoutes.post("/open-gate", openGate);

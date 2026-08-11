import { Router } from "express";
import { verifyExit, openGate } from "./exit.controller.js";

export const exitRouter = Router();

// POST /api/exit/verify — Verify RFID + xác định amountDue + canOpenGate
exitRouter.post("/verify", verifyExit);

// POST /api/exit/open-gate — Gate authorize + mở barie
exitRouter.post("/open-gate", openGate);

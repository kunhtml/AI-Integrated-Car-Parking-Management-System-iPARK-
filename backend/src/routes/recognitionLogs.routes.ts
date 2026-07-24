import { Router } from "express";
import {
  listRecognitionLogsHandler,
  streamRecognitionLogsHandler,
} from "../controllers/recognitionLogs.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const recognitionLogsRoutes = Router();

recognitionLogsRoutes.use(requireAuth, requireRole("admin", "staff"));
recognitionLogsRoutes.get(
  "/stream",
  asyncHandler(streamRecognitionLogsHandler),
);
recognitionLogsRoutes.get("/", asyncHandler(listRecognitionLogsHandler));

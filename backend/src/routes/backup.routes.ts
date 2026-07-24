import { Router } from "express";
import {
  createBackupHandler,
  listBackupsHandler,
  restoreBackupHandler,
  deleteBackupHandler,
} from "../controllers/backup.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const backupRoutes = Router();

backupRoutes.use(requireAuth, requireRole("admin"));

backupRoutes.post("/", asyncHandler(createBackupHandler));
backupRoutes.get("/", asyncHandler(listBackupsHandler));
backupRoutes.post("/:filename/restore", asyncHandler(restoreBackupHandler));
backupRoutes.delete("/:filename", asyncHandler(deleteBackupHandler));

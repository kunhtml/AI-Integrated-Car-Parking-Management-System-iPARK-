import { Router } from "express";
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "../controllers/notificationTemplates.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const notificationTemplatesRoutes = Router();

notificationTemplatesRoutes.use(requireAuth, requireRole("admin"));
notificationTemplatesRoutes.get("/", asyncHandler(listTemplates));
notificationTemplatesRoutes.post("/", asyncHandler(createTemplate));
notificationTemplatesRoutes.put("/:id", asyncHandler(updateTemplate));
notificationTemplatesRoutes.delete("/:id", asyncHandler(deleteTemplate));

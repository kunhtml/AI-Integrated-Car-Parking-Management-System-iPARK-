import { Router } from "express";
import {
  createNotificationController,
  listNotifications,
  markNotificationRead,
  sendPromotionHandler,
} from "../controllers/notifications.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const notificationsRoutes = Router();

notificationsRoutes.use(requireAuth);
notificationsRoutes.get("/", asyncHandler(listNotifications));
notificationsRoutes.post("/", requireRole("admin"), asyncHandler(createNotificationController));
notificationsRoutes.post("/promotion", requireRole("admin"), asyncHandler(sendPromotionHandler));
notificationsRoutes.patch("/:id/read", asyncHandler(markNotificationRead));

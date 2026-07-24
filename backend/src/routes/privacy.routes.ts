import { Router } from "express";
import {
  exportUserData,
  deleteUserData,
  getPrivacySettings,
} from "../controllers/privacy.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const privacyRoutes = Router();

privacyRoutes.use(requireAuth);

privacyRoutes.get("/export", asyncHandler(exportUserData));
privacyRoutes.delete("/delete", asyncHandler(deleteUserData));
privacyRoutes.get("/settings", asyncHandler(getPrivacySettings));

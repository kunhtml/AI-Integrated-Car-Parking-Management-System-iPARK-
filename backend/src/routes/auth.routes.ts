import { Router } from "express";
import {
  forgotPassword,
  logout,
  resetPassword,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRoutes = Router();

authRoutes.post("/forgot-password", asyncHandler(forgotPassword));
authRoutes.post("/reset-password", asyncHandler(resetPassword));
authRoutes.post("/logout", logout);

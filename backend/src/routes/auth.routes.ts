import { Router } from "express";
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  resetPassword,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRoutes = Router();

authRoutes.post("/login", asyncHandler(login));
authRoutes.post("/forgot-password", asyncHandler(forgotPassword));
authRoutes.post("/reset-password", asyncHandler(resetPassword));
authRoutes.post("/change-password", requireAuth, asyncHandler(changePassword));
authRoutes.post("/logout", logout);

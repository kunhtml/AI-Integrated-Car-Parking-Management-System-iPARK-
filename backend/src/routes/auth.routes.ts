import { Router } from "express";
import {
  changePassword,
  disableTwoFactor,
  forgotPassword,
  googleCallback,
  googleLogin,
  login,
  logout,
  me,
  register,
  resetPassword,
  setupTwoFactor,
  verifyTwoFactor,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRoutes = Router();

authRoutes.post("/register", asyncHandler(register));
authRoutes.post("/login", asyncHandler(login));
authRoutes.get("/google", googleLogin);
authRoutes.get("/google/callback", asyncHandler(googleCallback));
authRoutes.get("/me", requireAuth, me);
authRoutes.post("/forgot-password", asyncHandler(forgotPassword));
authRoutes.post("/reset-password", asyncHandler(resetPassword));
authRoutes.post("/change-password", requireAuth, asyncHandler(changePassword));
authRoutes.post("/2fa/setup", requireAuth, asyncHandler(setupTwoFactor));
authRoutes.post("/2fa/verify", requireAuth, asyncHandler(verifyTwoFactor));
authRoutes.post("/2fa/disable", requireAuth, asyncHandler(disableTwoFactor));
authRoutes.post("/logout", logout);

import { Router } from "express";
import {
  changePassword,
  disableTwoFactor,
  forgotPassword,
  googleCallback,
  googleLogin,
  listActiveSessions,
  login,
  logout,
  me,
  register,
  resendOtp,
  resetPassword,
  revokeAllSessions,
  revokeSession,
  setupTwoFactor,
  updateProfile,
  verifyTwoFactor,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRoutes = Router();

authRoutes.post("/register", asyncHandler(register));
authRoutes.post("/login", asyncHandler(login));
authRoutes.post("/forgot-password", asyncHandler(forgotPassword));
authRoutes.post("/resend-otp", asyncHandler(resendOtp));
authRoutes.post("/reset-password", asyncHandler(resetPassword));
authRoutes.get("/google", googleLogin);
authRoutes.get("/google/callback", asyncHandler(googleCallback));
authRoutes.post("/logout", logout);
authRoutes.get("/me", requireAuth, me);
authRoutes.put("/profile", requireAuth, asyncHandler(updateProfile));
authRoutes.post("/change-password", requireAuth, asyncHandler(changePassword));
authRoutes.post("/2fa/setup", requireAuth, asyncHandler(setupTwoFactor));
authRoutes.post("/2fa/verify", requireAuth, asyncHandler(verifyTwoFactor));
authRoutes.post("/2fa/disable", requireAuth, asyncHandler(disableTwoFactor));
authRoutes.get("/sessions", requireAuth, asyncHandler(listActiveSessions));
authRoutes.delete("/sessions/:id", requireAuth, asyncHandler(revokeSession));
authRoutes.delete("/sessions", requireAuth, asyncHandler(revokeAllSessions));

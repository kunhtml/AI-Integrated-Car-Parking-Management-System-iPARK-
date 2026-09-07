import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { Router } from "express";
import { rateLimit } from "../middlewares/rate-limit.middleware.js";
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
  requestChangeEmail,
  requestDisableTwoFactor,
  resendOtp,
  resendTwoFactorOtp,
  resendVerificationOtp,
  resetPassword,
  revokeAllSessions,
  revokeSession,
  setupTwoFactor,
  updateProfile,
  uploadAvatar,
  verifyChangeEmail,
  verifyEmailOtp,
  verifyLoginTwoFactor,
  verifyTwoFactor,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục lưu avatar. Đường dẫn có thể override qua env UPLOADS_AVATAR_DIR.
const AVATAR_DIR = process.env.UPLOADS_AVATAR_DIR
  ? path.resolve(process.env.UPLOADS_AVATAR_DIR)
  : path.resolve(__dirname, "../../uploads/avatars");
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname || "").toLowerCase() ||
        ".jpg") as string;
      const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
        ? ext
        : ".jpg";
      cb(
        null,
        `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`,
      );
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Chỉ chấp nhận file ảnh."));
      return;
    }
    cb(null, true);
  },
});

// SEC: giới hạn tần suất để chặn brute-force OTP/mật khẩu theo IP.
const loginLimiter = rateLimit({
  keyPrefix: "login",
  max: 10,
  windowMs: 5 * 60 * 1000,
});
const otpLimiter = rateLimit({
  keyPrefix: "otp",
  max: 10,
  windowMs: 5 * 60 * 1000,
});
const passwordResetLimiter = rateLimit({
  keyPrefix: "pw-reset",
  max: 5,
  windowMs: 15 * 60 * 1000,
});

export const authRoutes = Router();

authRoutes.post("/register", asyncHandler(register));
authRoutes.post("/verify-email", otpLimiter, asyncHandler(verifyEmailOtp));
authRoutes.post(
  "/resend-verification-otp",
  asyncHandler(resendVerificationOtp),
);

authRoutes.post("/login", loginLimiter, asyncHandler(login));
authRoutes.post(
  "/forgot-password",
  passwordResetLimiter,
  asyncHandler(forgotPassword),
);
authRoutes.post("/resend-otp", otpLimiter, asyncHandler(resendOtp));
authRoutes.post(
  "/reset-password",
  passwordResetLimiter,
  asyncHandler(resetPassword),
);
authRoutes.get("/google", googleLogin);
authRoutes.get("/google/callback", asyncHandler(googleCallback));
authRoutes.post("/logout", logout);
authRoutes.get("/me", requireAuth, me);
authRoutes.post(
  "/avatar",
  requireAuth,
  avatarUpload.single("file"),
  asyncHandler(uploadAvatar),
);
authRoutes.put("/profile", requireAuth, asyncHandler(updateProfile));
authRoutes.post("/change-password", requireAuth, asyncHandler(changePassword));
authRoutes.post(
  "/request-change-email",
  requireAuth,
  asyncHandler(requestChangeEmail),
);
authRoutes.post(
  "/verify-change-email",
  requireAuth,
  asyncHandler(verifyChangeEmail),
);
authRoutes.post("/2fa/setup", requireAuth, asyncHandler(setupTwoFactor));
authRoutes.post(
  "/2fa/verify",
  requireAuth,
  otpLimiter,
  asyncHandler(verifyTwoFactor),
);
authRoutes.post(
  "/2fa/resend-otp",
  requireAuth,
  otpLimiter,
  asyncHandler(resendTwoFactorOtp),
);
authRoutes.post(
  "/2fa/request-disable",
  requireAuth,
  asyncHandler(requestDisableTwoFactor),
);
authRoutes.post(
  "/2fa/disable",
  requireAuth,
  otpLimiter,
  asyncHandler(disableTwoFactor),
);
authRoutes.post(
  "/2fa/login-verify",
  otpLimiter,
  asyncHandler(verifyLoginTwoFactor),
);
authRoutes.get("/sessions", requireAuth, asyncHandler(listActiveSessions));
authRoutes.delete("/sessions/:id", requireAuth, asyncHandler(revokeSession));
authRoutes.delete("/sessions", requireAuth, asyncHandler(revokeAllSessions));

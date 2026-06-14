import { Router } from "express";
import {
  login,
  logout,
  me,
  register,
  resendForgotPasswordOtpController,
  resetPasswordController,
  sendForgotPasswordOtpController,
  verifyForgotPasswordOtpController,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  forgotPasswordEmailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../validations/auth.validation.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.get("/me", authMiddleware, me);
router.post("/logout", authMiddleware, logout);

router.post(
  "/forgot-password/send-otp",
  validate(forgotPasswordEmailSchema),
  sendForgotPasswordOtpController
);
router.post(
  "/forgot-password/resend-otp",
  validate(forgotPasswordEmailSchema),
  resendForgotPasswordOtpController
);
router.post(
  "/forgot-password/verify-otp",
  validate(verifyOtpSchema),
  verifyForgotPasswordOtpController
);
router.post(
  "/forgot-password/reset-password",
  validate(resetPasswordSchema),
  resetPasswordController
);

export default router;

import type { Response } from "express";
import * as authService from "../services/auth.service.js";
import {
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
} from "../services/otp.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

export const register = asyncHandler(async (req, res: Response) => {
  const data = await authService.register(req.body);

  return res.status(201).json({
    success: true,
    message: "Đăng ký tài khoản thành công",
    data,
  });
});

export const login = asyncHandler(async (req, res: Response) => {
  const data = await authService.login(req.body);

  return res.status(200).json({
    success: true,
    message: "Đăng nhập thành công",
    data,
  });
});

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);

  return res.status(200).json({
    success: true,
    message: "Lấy thông tin tài khoản thành công",
    data: { user },
  });
});

export const logout = asyncHandler(async (_req, res: Response) => {
  return res.status(200).json({
    success: true,
    message: "Đăng xuất thành công",
  });
});

export const sendForgotPasswordOtpController = asyncHandler(
  async (req, res: Response) => {
    const data = await sendForgotPasswordOtp(req.body.email, false);

    return res.status(200).json({
      success: true,
      message: "Mã OTP đã được gửi tới email",
      data,
    });
  }
);

export const resendForgotPasswordOtpController = asyncHandler(
  async (req, res: Response) => {
    const data = await sendForgotPasswordOtp(req.body.email, true);

    return res.status(200).json({
      success: true,
      message: "Mã OTP mới đã được gửi lại tới email",
      data,
    });
  }
);

export const verifyForgotPasswordOtpController = asyncHandler(
  async (req, res: Response) => {
    const data = await verifyForgotPasswordOtp(req.body.email, req.body.otp);

    return res.status(200).json({
      success: true,
      message: "Xác thực OTP thành công",
      data,
    });
  }
);

export const resetPasswordController = asyncHandler(async (req, res: Response) => {
  const user = await authService.resetPassword(req.body);

  return res.status(200).json({
    success: true,
    message: "Đặt lại mật khẩu thành công",
    data: { user },
  });
});

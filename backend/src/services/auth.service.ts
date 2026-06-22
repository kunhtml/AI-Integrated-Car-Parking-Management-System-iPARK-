import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { UserModel } from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { markForgotPasswordOtpsAsUsed } from "./otp.service.js";
import {
  normalizeUserId,
  signAccessToken,
  verifyResetToken,
} from "./token.service.js";

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ResetPasswordInput {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}

function sanitizeUser(user: any) {
  return {
    id: normalizeUserId(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function register(input: RegisterInput) {
  if (input.password !== input.confirmPassword) {
    throw new AppError("Mật khẩu xác nhận không khớp", 400);
  }

  const email = input.email.toLowerCase().trim();
  const existedUser = await UserModel.findOne({ email });

  if (existedUser) {
    throw new AppError("Email đã được sử dụng", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, env.bcryptSaltRounds);
  const user = await UserModel.create({
    name: input.name,
    email,
    phone: input.phone,
    password: passwordHash,
  });

  const accessToken = await signAccessToken({
    userId: normalizeUserId(user._id),
    email: user.email,
    role: user.role,
  });

  return {
    user: sanitizeUser(user),
    accessToken,
  };
}

export async function login(input: LoginInput) {
  const email = input.email.toLowerCase().trim();
  const user = await UserModel.findOne({ email }).select("+password");

  if (!user) {
    throw new AppError("Email hoặc mật khẩu không chính xác", 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    throw new AppError("Email hoặc mật khẩu không chính xác", 401);
  }

  const accessToken = await signAccessToken({
    userId: normalizeUserId(user._id),
    email: user.email,
    role: user.role,
  });

  return {
    user: sanitizeUser(user),
    accessToken,
  };
}

export async function getCurrentUser(userId: string) {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new AppError("Không tìm thấy tài khoản", 404);
  }

  return sanitizeUser(user);
}

export async function resetPassword(input: ResetPasswordInput) {
  if (input.newPassword !== input.confirmPassword) {
    throw new AppError("Mật khẩu xác nhận không khớp", 400);
  }

  const payload = await verifyResetToken(input.resetToken);

  if (payload.purpose !== "reset_password") {
    throw new AppError("Reset token không hợp lệ", 400);
  }

  const user = await UserModel.findOne({ email: payload.email }).select("+password");

  if (!user) {
    throw new AppError("Không tìm thấy tài khoản", 404);
  }

  user.password = await bcrypt.hash(input.newPassword, env.bcryptSaltRounds);
  await user.save();
  await markForgotPasswordOtpsAsUsed(payload.email);

  return sanitizeUser(user);
}

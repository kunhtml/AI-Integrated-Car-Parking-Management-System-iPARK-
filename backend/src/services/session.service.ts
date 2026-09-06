import { Request } from "express";
import mongoose from "mongoose";
import { ActiveSession } from "../models/ActiveSession.js";

// Phải khớp thời hạn cookie/token 8h trong auth.controller.ts.
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Tạo bản ghi ActiveSession cho một lần đăng nhập thành công.
 * TTL index trên expiresAt sẽ tự dọn bản ghi quá hạn.
 */
export async function createActiveSession(
  request: Request,
  userId: mongoose.Types.ObjectId,
) {
  const uaHeader = request.headers["user-agent"];
  const userAgent = (Array.isArray(uaHeader) ? uaHeader[0] : uaHeader) ?? null;

  return ActiveSession.create({
    userId,
    userAgent,
    ipAddress: request.ip ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    isRevoked: false,
  });
}

/**
 * Thu hồi mọi phiên đăng nhập của một user (khóa/xóa/đổi vai trò/đổi mật khẩu).
 * Dùng exceptSessionId để giữ lại phiên hiện tại (VD: user tự đổi mật khẩu).
 */
export async function revokeUserSessions(
  userId: string | mongoose.Types.ObjectId,
  options: { exceptSessionId?: string } = {},
): Promise<void> {
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(String(userId)),
    isRevoked: false,
  };

  if (
    options.exceptSessionId &&
    mongoose.isValidObjectId(options.exceptSessionId)
  ) {
    filter._id = { $ne: new mongoose.Types.ObjectId(options.exceptSessionId) };
  }

  await ActiveSession.updateMany(filter, { $set: { isRevoked: true } });
}

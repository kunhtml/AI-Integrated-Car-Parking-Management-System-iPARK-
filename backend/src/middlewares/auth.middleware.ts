import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ActiveSession } from "../models/ActiveSession.js";
import { User } from "../models/User.js";
import { verifySession } from "../services/token.service.js";

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const token = request.cookies?.parking_session;
  const claims = await verifySession(token);

  if (!claims) {
    response.status(401).json({ message: "Chưa đăng nhập." });
    return;
  }

  if (!mongoose.isValidObjectId(claims.id)) {
    response.status(401).json({ message: "Phiên đăng nhập không hợp lệ." });
    return;
  }

  // SEC-01: luôn đối chiếu DB — không cấp quyền từ claims cũ (role/status stale).
  let currentUser;
  try {
    currentUser = await User.findById(claims.id);
  } catch (error) {
    console.error("[auth] Không kiểm tra được trạng thái tài khoản:", error);
    response
      .status(503)
      .json({
        message: "Không thể xác minh phiên đăng nhập. Vui lòng thử lại.",
      });
    return;
  }

  if (!currentUser) {
    response.status(401).json({ message: "Tài khoản không còn tồn tại." });
    return;
  }

  if (currentUser.status !== "Đang hoạt động") {
    response.status(401).json({ message: "Tài khoản đã bị khóa." });
    return;
  }

  // Token mới chứa sid → bắt buộc ActiveSession còn hiệu lực và chưa bị thu hồi.
  // Token cũ (chưa có sid) vẫn được chấp nhận trong thời hạn 8h của cookie.
  if (claims.sid) {
    if (!mongoose.isValidObjectId(claims.sid)) {
      response.status(401).json({ message: "Phiên đăng nhập không hợp lệ." });
      return;
    }

    let session;
    try {
      session = await ActiveSession.findOne({
        _id: claims.sid,
        userId: currentUser._id,
        isRevoked: false,
        expiresAt: { $gt: new Date() },
      });
    } catch (error) {
      console.error("[auth] Không kiểm tra được phiên đăng nhập:", error);
      response
        .status(503)
        .json({
          message: "Không thể xác minh phiên đăng nhập. Vui lòng thử lại.",
        });
      return;
    }

    if (!session) {
      response
        .status(401)
        .json({ message: "Phiên đăng nhập đã hết hạn hoặc bị thu hồi." });
      return;
    }
  }

  request.user = {
    id: currentUser._id.toString(),
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.role,
    status: currentUser.status,
    avatarUrl: currentUser.avatarUrl ?? undefined,
    provider: currentUser.provider,
    sid: claims.sid,
  };
  next();
}

export function requireRole(...roles: string[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.user || !roles.includes(request.user.role)) {
      response.status(403).json({ message: "Không có quyền truy cập." });
      return;
    }

    next();
  };
}

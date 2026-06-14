import type { NextFunction, Request, Response } from "express";
import { UserModel } from "../models/user.model.js";
import { verifyAccessToken } from "../services/token.service.js";
import { AppError } from "../utils/AppError.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError("Vui lòng đăng nhập", 401);
    }

    const token = authorization.split(" ")[1];
    const payload = await verifyAccessToken(token);
    const user = await UserModel.findById(payload.userId);

    if (!user) {
      throw new AppError("Token không hợp lệ", 401);
    }

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch {
    next(new AppError("Phiên đăng nhập không hợp lệ hoặc đã hết hạn", 401));
  }
}

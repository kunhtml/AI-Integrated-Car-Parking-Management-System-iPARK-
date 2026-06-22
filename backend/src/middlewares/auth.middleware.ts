import { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { verifySession } from "../services/token.service.js";

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  if (env.skipAuth) {
    request.user = { id: "dev-user", role: "admin", email: "dev@local" };
    next();
    return;
  }

  const token = request.cookies?.parking_session;
  const user = await verifySession(token);

  if (!user) {
    response.status(401).json({ message: "Chưa đăng nhập." });
    return;
  }

  request.user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.user || !roles.includes(request.user.role || "")) {
      response.status(403).json({ message: "Không có quyền truy cập." });
      return;
    }

    next();
  };
}

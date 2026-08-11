import { NextFunction, Request, Response } from "express";
import { constantTimeEqual, getServiceToken } from "../services/service-token.js";

/**
 * Middleware xác thực cho Python bridge service (smart_parking_rut_gon).
 *
 * Client (Python) phải gửi header `X-Service-Token: <SERVICE_TOKEN>`.
 * Token được cấu hình trong .env qua biến SERVICE_TOKEN.
 *
 * So sánh constant-time để chống timing attack.
 */
export function requireServiceToken(request: Request, response: Response, next: NextFunction) {
  const token = request.header("x-service-token") || request.header("X-Service-Token");
  const expected = getServiceToken();

  if (!token || !expected) {
    response.status(401).json({
      ok: false,
      message: "Thiếu service token. Cần header X-Service-Token.",
    });
    return;
  }

  if (!constantTimeEqual(token, expected)) {
    response.status(401).json({
      ok: false,
      message: "Service token không hợp lệ.",
    });
    return;
  }

  // Service được coi như staff role để tương thích với các flow sẵn có
  (request as Request & { serviceRole?: string }).serviceRole = "staff";
  next();
}
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorMiddleware(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    const messages = err.issues.map((e) => e.message).filter(Boolean);
    res.status(400).json({ message: messages[0] || "Dữ liệu không hợp lệ.", errors: messages });
    return;
  }
  console.error(err);
  const status = err?.status || 500;
  res.status(status).json({ message: err?.message || "Lỗi máy chủ." });
}

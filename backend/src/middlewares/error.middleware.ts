import { Request, Response, NextFunction } from "express";
import { ZodError, ZodIssue } from "zod";

export function errorMiddleware(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
<<<<<<< HEAD
    const messages = err.issues.map((e) => e.message).filter(Boolean);
    res.status(400).json({ message: messages[0] || "Dữ liệu không hợp lệ.", errors: messages });
=======
    const messages = err.issues.map((e: ZodIssue) => e.message).filter(Boolean);
    res
      .status(400)
      .json({
        message: messages[0] || "Dữ liệu không hợp lệ.",
        errors: messages,
      });
>>>>>>> 49bfd09c69d8e4d4c7df76f95d064c30a0512d62
    return;
  }
  console.error(err);
  const status = err?.status || 500;
  res.status(status).json({ message: err?.message || "Lỗi máy chủ." });
}

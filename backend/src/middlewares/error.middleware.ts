import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ message: "Dữ liệu không hợp lệ.", errors: error.issues });
    return;
  }

  // Cho phép service throw Error có `.status` để controller nhận được mã HTTP đúng
  // (404 / 400 / 409). Status có thể là number trực tiếp gán trên Error instance.
  const status =
    typeof (error as { status?: unknown })?.status === "number"
      ? (error as { status: number }).status
      : 500;
  const msg = error instanceof Error ? error.message : String(error);
  if (status >= 500) {
    // Chỉ log stack cho 5xx; các lỗi nghiệp vụ 4xx log message gọn để tránh nhiễu.
    console.error("[Error]", msg, error?.stack ?? "");
  } else {
    console.warn("[Error]", status, msg);
  }
  response.status(status).json({ message: msg || "Lỗi hệ thống." });
};

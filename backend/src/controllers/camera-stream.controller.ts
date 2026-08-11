import { Request, Response } from "express";
import {
  cameraEventBus,
  CameraIngestEvent,
} from "../services/camera-event-bus.js";

/**
 * GET /api/camera-logs/stream
 * Server-Sent Events realtime: đẩy sự kiện camera (direction=in) tới
 * trang /staff-desk ngay khi bridge POST log.
 *
 * Frontend dùng `new EventSource(...)` (credentials: include để gửi cookie).
 * Trả về text/event-stream; heartbeat 25s để giữ kết nối qua proxy.
 */
export async function streamCameraEvents(request: Request, response: Response) {
  // SSE headers — KHÔNG set Content-Type, Express tự ghi text/event-stream.
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  // Disable nginx buffering (nếu chạy sau nginx ở prod).
  response.setHeader("X-Accel-Buffering", "no");
  // Flush headers ngay để client bắt đầu nhận.
  response.flushHeaders?.();

  // Báo client biết kết nối OK + gửi kèm role để client tự log.
  response.write(
    `event: connected\ndata: ${JSON.stringify({ ok: true, role: request.user?.role ?? null })}\n\n`,
  );

  const send = (event: CameraIngestEvent) => {
    // Mỗi event SSE: `event: <name>\ndata: <json>\n\n`
    response.write(`event: camera.ingest\ndata: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribe = cameraEventBus.subscribe(send);

  // Heartbeat mỗi 25s — giữ kết nối và phát hiện client disconnect sớm.
  const heartbeat = setInterval(() => {
    response.write(`: ping ${Date.now()}\n\n`);
  }, 25_000);

  // Khi client đóng kết nối → dọn dẹp listener + interval.
  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };
  request.on("close", cleanup);
  request.on("aborted", cleanup);
  response.on("close", cleanup);
}

import { Request, Response } from "express";
import { z } from "zod";
import {
  RECOGNITION_ACTIONS,
  RECOGNITION_SOURCES,
  RECOGNITION_STATUSES,
} from "../models/RecognitionLog.js";
import {
  RECOGNITION_LOGS_MAX_LIMIT,
  listRecognitionLogs,
} from "../services/recognitionLog.service.js";
import { subscribeRealtime } from "../services/realtime.service.js";
import { serializeRecognitionLog } from "../utils/serializers.js";

const listQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RECOGNITION_LOGS_MAX_LIMIT)
    .optional(),
  status: z.enum(RECOGNITION_STATUSES).optional(),
  action: z.enum(RECOGNITION_ACTIONS).optional(),
  source: z.enum(RECOGNITION_SOURCES).optional(),
  cursor: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "cursor phải là một ObjectId hợp lệ")
    .optional(),
});

export async function listRecognitionLogsHandler(
  request: Request,
  response: Response,
) {
  const query = listQuerySchema.parse(request.query);
  const { logs, nextCursor } = await listRecognitionLogs(query);
  response.json({ logs: logs.map(serializeRecognitionLog), nextCursor });
}

/** SSE stream: recognition-log events realtime cho admin/staff dashboard. */
export async function streamRecognitionLogsHandler(
  request: Request,
  response: Response,
) {
  request.socket.setTimeout(0);
  subscribeRealtime(
    response,
    request.user?.role ? [request.user.role] : undefined,
  );
}

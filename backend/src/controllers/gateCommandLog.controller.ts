import { Request, Response } from "express";
import { z } from "zod";
import {
  GATE_LOGS_MAX_LIMIT,
  listGateCommandLogs,
} from "../services/gateCommandLog.service.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(GATE_LOGS_MAX_LIMIT).optional(),
  gate: z.enum(["in", "out"]).optional(),
  command: z.enum(["open", "close"]).optional(),
  source: z.string().trim().max(100).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
});

/** GET /api/gate-command-logs */
export async function listGateCommandLogsHandler(
  request: Request,
  response: Response,
) {
  const query = listQuerySchema.parse(request.query);
  const { logs, nextCursor } = await listGateCommandLogs(query);
  response.json({
    logs: logs.map((log) => ({
      id: log._id.toString(),
      gate: log.gate,
      command: log.command,
      source: log.source,
      success: log.success,
      message: log.message || "",
      createdAt: log.createdAt,
    })),
    nextCursor,
  });
}

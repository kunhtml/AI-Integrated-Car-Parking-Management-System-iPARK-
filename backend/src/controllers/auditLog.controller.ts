import { Request, Response } from "express";
import { z } from "zod";
import {
  AUDIT_LOGS_MAX_LIMIT,
  listAuditLogs,
  getAuditLogStats,
} from "../services/auditLog.service.js";

const listQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(AUDIT_LOGS_MAX_LIMIT)
    .optional(),
  entityType: z.string().optional(),
  performedBy: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "performedBy phải là một ObjectId hợp lệ")
    .optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "cursor phải là một ObjectId hợp lệ")
    .optional(),
});

export async function listAuditLogsHandler(
  request: Request,
  response: Response,
) {
  const query = listQuerySchema.parse(request.query);
  const { logs, nextCursor } = await listAuditLogs(query);
  response.json({ logs, nextCursor });
}

export async function getAuditLogStatsHandler(
  _request: Request,
  response: Response,
) {
  const stats = await getAuditLogStats();
  response.json(stats);
}

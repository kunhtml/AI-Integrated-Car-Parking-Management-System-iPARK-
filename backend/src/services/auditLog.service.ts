import mongoose from "mongoose";
import { AuditLog, AuditLogDocument } from "../models/AuditLog.js";

export const AUDIT_LOGS_DEFAULT_LIMIT = 50;
export const AUDIT_LOGS_MAX_LIMIT = 200;

export type CreateAuditLogInput = {
  action: string;
  entityType: string;
  entityId: string | mongoose.Types.ObjectId;
  performedBy: string | mongoose.Types.ObjectId;
  changes?: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  ipAddress?: string;
  userAgent?: string;
};

export type ListAuditLogsOptions = {
  limit?: number;
  entityType?: string;
  performedBy?: string;
  from?: string;
  to?: string;
  cursor?: string;
};

export type ListAuditLogsResult = {
  logs: AuditLogDocument[];
  nextCursor: string | null;
};

function toObjectId(value?: string | mongoose.Types.ObjectId) {
  if (!value) return undefined;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : undefined;
}

export async function createAuditLog(input: CreateAuditLogInput) {
  return AuditLog.create({
    ...input,
    entityId: toObjectId(input.entityId),
    performedBy: toObjectId(input.performedBy),
  });
}

export async function listAuditLogs(
  options: ListAuditLogsOptions,
): Promise<ListAuditLogsResult> {
  const limit = Math.min(
    Math.max(options.limit ?? AUDIT_LOGS_DEFAULT_LIMIT, 1),
    AUDIT_LOGS_MAX_LIMIT,
  );

  const criteria: Record<string, unknown> = {};

  if (options.entityType) {
    criteria.entityType = options.entityType;
  }

  if (options.performedBy && mongoose.isValidObjectId(options.performedBy)) {
    criteria.performedBy = new mongoose.Types.ObjectId(options.performedBy);
  }

  if (options.from || options.to) {
    const createdAtFilter: Record<string, Date> = {};
    if (options.from) {
      createdAtFilter.$gte = new Date(options.from);
    }
    if (options.to) {
      createdAtFilter.$lte = new Date(options.to);
    }
    criteria.createdAt = createdAtFilter;
  }

  if (options.cursor && mongoose.isValidObjectId(options.cursor)) {
    criteria._id = { $lt: new mongoose.Types.ObjectId(options.cursor) };
  }

  const logs = await AuditLog.find(criteria)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("performedBy", "name email role")
    .lean<AuditLogDocument[]>();

  const hasMore = logs.length > limit;
  const page = hasMore ? logs.slice(0, limit) : logs;

  return {
    logs: page,
    nextCursor:
      hasMore && page.length ? page[page.length - 1]._id.toString() : null,
  };
}

export async function getAuditLogStats() {
  const [actionStats, entityStats] = await Promise.all([
    AuditLog.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AuditLog.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$entityType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return { actionStats, entityStats };
}

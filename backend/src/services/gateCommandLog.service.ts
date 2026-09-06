import mongoose from "mongoose";
import { GateCommandLog, GateCommandLogDocument } from "../models/GateCommandLog.js";

export const GATE_LOGS_DEFAULT_LIMIT = 50;
export const GATE_LOGS_MAX_LIMIT = 200;

export type CreateGateCommandLogInput = {
  gate: "in" | "out";
  command: "open" | "close";
  source: string;
  sessionId?: string | mongoose.Types.ObjectId;
  plate?: string;
  success?: boolean;
  message?: string;
};

export type ListGateCommandLogsOptions = {
  limit?: number;
  gate?: string;
  command?: string;
  source?: string;
  from?: string;
  to?: string;
  cursor?: string;
};

export type ListGateCommandLogsResult = {
  logs: GateCommandLogDocument[];
  nextCursor: string | null;
};

/** Ghi lịch sử lệnh mở/đóng barrier. Không ném lỗi ra ngoài để không làm hỏng luồng mở gate. */
export async function createGateCommandLog(input: CreateGateCommandLogInput) {
  try {
    return await GateCommandLog.create({
      gate: input.gate,
      command: input.command,
      source: input.source,
      sessionId:
        input.sessionId && mongoose.isValidObjectId(input.sessionId)
          ? new mongoose.Types.ObjectId(input.sessionId)
          : undefined,
      plate: input.plate || "",
      success: input.success ?? true,
      message: input.message || "",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[gateCommandLog] ghi log thất bại:", err);
    return null;
  }
}

export async function listGateCommandLogs(
  options: ListGateCommandLogsOptions,
): Promise<ListGateCommandLogsResult> {
  const limit = Math.min(
    Math.max(options.limit ?? GATE_LOGS_DEFAULT_LIMIT, 1),
    GATE_LOGS_MAX_LIMIT,
  );

  const criteria: Record<string, unknown> = {};

  if (options.gate && ["in", "out"].includes(options.gate)) {
    criteria.gate = options.gate;
  }
  if (options.command && ["open", "close"].includes(options.command)) {
    criteria.command = options.command;
  }
  if (options.source) {
    criteria.source = options.source;
  }
  if (options.from || options.to) {
    const createdAtFilter: Record<string, Date> = {};
    if (options.from) createdAtFilter.$gte = new Date(options.from);
    if (options.to) createdAtFilter.$lte = new Date(options.to);
    criteria.createdAt = createdAtFilter;
  }
  if (options.cursor && mongoose.isValidObjectId(options.cursor)) {
    criteria._id = { $lt: new mongoose.Types.ObjectId(options.cursor) };
  }

  const logs = await GateCommandLog.find(criteria)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean<GateCommandLogDocument[]>();

  const hasMore = logs.length > limit;
  const page = hasMore ? logs.slice(0, limit) : logs;

  return {
    logs: page,
    nextCursor:
      hasMore && page.length ? page[page.length - 1]._id.toString() : null,
  };
}

import mongoose from "mongoose";
type FilterQuery<T> = Record<string, any>;
import {
  RecognitionAction,
  RecognitionLog,
  RecognitionLogDocument,
  RecognitionMatchStatus,
  RecognitionSource,
  RecognitionStatus,
} from "../models/RecognitionLog.js";

export const RECOGNITION_LOGS_DEFAULT_LIMIT = 50;
export const RECOGNITION_LOGS_MAX_LIMIT = 200;

export type CreateRecognitionLogInput = {
  action: RecognitionAction;
  source: RecognitionSource;
  status: RecognitionStatus;
  plate?: string;
  detectedPlate?: string;
  confidence?: number;
  rawText?: string;
  imageHash?: string;
  imageUrl?: string;
  vehicleType?: string;
  detectionMethod?: string; // plate-model | vehicle-contour | full-image-ocr | filename-fallback | manual
  sessionId?: string | mongoose.Types.ObjectId;
  deviceId?: string | mongoose.Types.ObjectId;
  deviceName?: string;
  matched?: boolean;
  matchStatus?: RecognitionMatchStatus;
  vehicleMatchScore?: number;
  message?: string;
  createdBy?: string | mongoose.Types.ObjectId;
};

export type ListRecognitionLogsOptions = {
  limit?: number;
  status?: RecognitionStatus;
  action?: RecognitionAction;
  source?: RecognitionSource;
  /** _id của bản ghi cuối trang trước, dùng cho phân trang cursor. */
  cursor?: string;
};

export type ListRecognitionLogsResult = {
  logs: RecognitionLogDocument[];
  nextCursor: string | null;
};

function toObjectId(value?: string | mongoose.Types.ObjectId) {
  if (!value) {
    return undefined;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : undefined;
}

export async function createRecognitionLog(input: CreateRecognitionLogInput) {
  const log = await RecognitionLog.create({
    ...input,
    plate: input.plate?.toUpperCase(),
    detectedPlate: input.detectedPlate?.toUpperCase(),
    detectionMethod: input.detectionMethod,
    sessionId: toObjectId(input.sessionId),
    deviceId: toObjectId(input.deviceId),
    createdBy: toObjectId(input.createdBy),
  });

  try {
    const { publishRealtime } = await import("./realtime.service.js");
    const { serializeRecognitionLog } = await import("../utils/serializers.js");
    publishRealtime("recognition-log", serializeRecognitionLog(log));
  } catch (error) {
    console.error("[recognition-log] Không publish realtime event:", error);
  }

  return log;
}

/**
 * Ghi log audit nhưng KHÔNG BAO GIỜ ném lỗi ra ngoài:
 * việc ghi log nhận diện không được phép làm hỏng luồng check-in/check-out chính.
 */
export async function safeCreateRecognitionLog(
  input: CreateRecognitionLogInput,
) {
  try {
    return await createRecognitionLog(input);
  } catch (error) {
    console.error("[recognition-log] Không ghi được log nhận diện:", error);
    return null;
  }
}

export async function listRecognitionLogs(
  options: ListRecognitionLogsOptions,
): Promise<ListRecognitionLogsResult> {
  const limit = Math.min(
    Math.max(options.limit ?? RECOGNITION_LOGS_DEFAULT_LIMIT, 1),
    RECOGNITION_LOGS_MAX_LIMIT,
  );

  const criteria: FilterQuery<RecognitionLogDocument> = {};
  if (options.status) {
    criteria.status = options.status;
  }
  if (options.action) {
    criteria.action = options.action;
  }
  if (options.source) {
    criteria.source = options.source;
  }
  if (options.cursor && mongoose.isValidObjectId(options.cursor)) {
    // ObjectId chứa timestamp nên sort theo _id giảm dần ~ mới nhất trước.
    criteria._id = { $lt: new mongoose.Types.ObjectId(options.cursor) };
  }

  // Lấy dư 1 bản ghi để biết còn trang sau hay không.
  const logs = await RecognitionLog.find(criteria)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean<RecognitionLogDocument[]>();

  const hasMore = logs.length > limit;
  const page = hasMore ? logs.slice(0, limit) : logs;

  return {
    logs: page,
    nextCursor:
      hasMore && page.length ? page[page.length - 1]._id.toString() : null,
  };
}

import mongoose, { Model, Schema } from "mongoose";

export const RECOGNITION_ACTIONS = [
  "entry",
  "exit",
  "camera-entry",
  "camera-exit",
  "manual",
] as const;
export const RECOGNITION_SOURCES = ["upload", "camera"] as const;
export const RECOGNITION_STATUSES = [
  "success",
  "failed",
  "mismatch",
  "pending-verification",
] as const;
export const RECOGNITION_MATCH_STATUSES = ["Chưa checkout", "Khớp", "Không khớp"] as const;

export type RecognitionAction = (typeof RECOGNITION_ACTIONS)[number];
export type RecognitionSource = (typeof RECOGNITION_SOURCES)[number];
export type RecognitionStatus = (typeof RECOGNITION_STATUSES)[number];
export type RecognitionMatchStatus = (typeof RECOGNITION_MATCH_STATUSES)[number];

export type RecognitionLogDocument = {
  _id: mongoose.Types.ObjectId;
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
  sessionId?: mongoose.Types.ObjectId;
  deviceId?: mongoose.Types.ObjectId;
  deviceName?: string;
  matched?: boolean;
  matchStatus?: RecognitionMatchStatus;
  vehicleMatchScore?: number;
  message?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const recognitionLogSchema = new Schema<RecognitionLogDocument>(
  {
    action: { type: String, enum: RECOGNITION_ACTIONS, required: true, index: true },
    source: { type: String, enum: RECOGNITION_SOURCES, required: true, index: true },
    status: { type: String, enum: RECOGNITION_STATUSES, required: true, index: true },
    plate: { type: String, trim: true, uppercase: true },
    detectedPlate: { type: String, trim: true, uppercase: true, index: true },
    confidence: { type: Number, min: 0, max: 100 },
    rawText: { type: String },
    imageHash: { type: String },
    imageUrl: { type: String },
    vehicleType: { type: String },
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession", index: true },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device", index: true },
    deviceName: { type: String },
    matched: { type: Boolean },
    matchStatus: { type: String, enum: RECOGNITION_MATCH_STATUSES },
    vehicleMatchScore: { type: Number },
    message: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true },
);

// Truy vấn "log mới nhất" và phân trang cursor theo _id giảm dần.
recognitionLogSchema.index({ createdAt: -1 });
recognitionLogSchema.index({ status: 1, _id: -1 });

// Data retention: tự động xoá log cũ khi cấu hình RECOGNITION_LOG_TTL_DAYS > 0.
// Ví dụ RECOGNITION_LOG_TTL_DAYS=90 sẽ giữ log nhận diện trong 90 ngày.
const ttlDays = Number(process.env.RECOGNITION_LOG_TTL_DAYS ?? 0);
if (Number.isFinite(ttlDays) && ttlDays > 0) {
  recognitionLogSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: Math.round(ttlDays * 24 * 60 * 60) },
  );
}

export const RecognitionLog: Model<RecognitionLogDocument> =
  mongoose.models.RecognitionLog ||
  mongoose.model<RecognitionLogDocument>("RecognitionLog", recognitionLogSchema);

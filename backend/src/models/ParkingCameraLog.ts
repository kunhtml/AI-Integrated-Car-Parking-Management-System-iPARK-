import mongoose, { Model, Schema } from "mongoose";

export type CameraDirection = "in" | "out";

/**
 * Vòng đời review xe vào: camera chỉ tạo pending review; session và barie
 * chỉ được tạo/mở sau khi nhân viên xác nhận chéo biển số.
 */
export type EntryReviewState = "pending_review" | "confirmed" | "dismissed";

export type ParkingCameraLogDocument = {
  _id: mongoose.Types.ObjectId;
  direction: CameraDirection;
  detectedPlate: string;
  confidence?: number;
  rfidUid?: string;
  ownerName?: string;
  plate?: string;
  userType?: "resident" | "guest" | "unknown";
  imagePath?: string;
  barrierOpened: boolean;
  sessionId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  rfidCardId?: mongoose.Types.ObjectId;
  /** Chỉ dùng cho log hướng "in": trạng thái review của nhân viên. */
  entryReviewState?: EntryReviewState;
  /** Biển số nhân viên xác nhận (khác detectedPlate nếu AI nhận sai). */
  confirmedPlate?: string;
  /** Ghi chú xác nhận của nhân viên. */
  confirmationNote?: string;
  confirmedBy?: mongoose.Types.ObjectId;
  confirmedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const parkingCameraLogSchema = new Schema<ParkingCameraLogDocument>(
  {
    direction: {
      type: String,
      enum: ["in", "out"],
      required: true,
      index: true,
    },
    detectedPlate: {
      type: String,
      required: false,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
    },
    confidence: { type: Number, min: 0, max: 1 },
    rfidUid: { type: String, trim: true, index: true },
    ownerName: { type: String, trim: true },
    plate: { type: String, trim: true, uppercase: true },
    userType: {
      type: String,
      enum: ["resident", "guest", "unknown"],
      default: "unknown",
    },
    imagePath: { type: String },
    barrierOpened: { type: Boolean, default: false },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "ParkingSession",
      index: true,
    },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", index: true },
    rfidCardId: { type: Schema.Types.ObjectId, ref: "RfidCard", index: true },
    entryReviewState: {
      type: String,
      enum: ["pending_review", "confirmed", "dismissed"],
      default: undefined,
      index: true,
    },
    confirmedPlate: {
      type: String,
      trim: true,
      uppercase: true,
    },
    confirmationNote: { type: String, trim: true },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    confirmedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

parkingCameraLogSchema.index({ createdAt: -1 });
parkingCameraLogSchema.index({
  direction: 1,
  entryReviewState: 1,
  createdAt: -1,
});

export const ParkingCameraLog: Model<ParkingCameraLogDocument> =
  mongoose.models.ParkingCameraLog ||
  mongoose.model<ParkingCameraLogDocument>(
    "ParkingCameraLog",
    parkingCameraLogSchema,
  );

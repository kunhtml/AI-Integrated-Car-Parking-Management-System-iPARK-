import mongoose, { Model, Schema } from "mongoose";

export type CameraDirection = "in" | "out";

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
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

parkingCameraLogSchema.index({ createdAt: -1 });

export const ParkingCameraLog: Model<ParkingCameraLogDocument> =
  mongoose.models.ParkingCameraLog ||
  mongoose.model<ParkingCameraLogDocument>(
    "ParkingCameraLog",
    parkingCameraLogSchema,
  );

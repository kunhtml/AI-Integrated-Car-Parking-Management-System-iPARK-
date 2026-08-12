import mongoose, { Model, Schema } from "mongoose";

export type RfidScanLogDocument = {
  _id: mongoose.Types.ObjectId;
  cardId: string;
  action: "entry" | "exit" | "assign" | "return" | "block" | "unblock" | "report-lost" | "sale" | "replace" | "lost" | "damaged" | "available";
  sessionId?: mongoose.Types.ObjectId;
  deviceId?: mongoose.Types.ObjectId;
  performedBy?: mongoose.Types.ObjectId;
  status: "success" | "failed" | "blocked" | "mismatch";
  failureReason?: string;
  plateDetected?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

const rfidScanLogSchema = new Schema<RfidScanLogDocument>(
  {
    cardId: { type: String, required: true, trim: true, uppercase: true, index: true },
    action: {
      type: String,
      enum: ["entry", "exit", "assign", "return", "block", "unblock", "report-lost", "sale", "replace", "lost", "damaged", "available"],
      required: true,
    },
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession" },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device" },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["success", "failed", "blocked", "mismatch"],
      default: "success",
    },
    failureReason: { type: String, trim: true },
    plateDetected: { type: String, trim: true, uppercase: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL index: auto-delete after 90 days
rfidScanLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const RfidScanLog: Model<RfidScanLogDocument> =
  mongoose.models.RfidScanLog ||
  mongoose.model<RfidScanLogDocument>("RfidScanLog", rfidScanLogSchema);

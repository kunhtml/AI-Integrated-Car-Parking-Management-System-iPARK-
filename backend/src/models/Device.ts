import mongoose, { Model, Schema } from "mongoose";

export type DeviceDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  gate: "entry" | "exit";
  rtspUrl?: string;
  username?: string;
  password?: string;
  roiNote?: string;
  status: "online" | "offline";
  barrierStatus: "open" | "closed";
  lastSnapshotUrl?: string;
  lastSnapshotAt?: Date;
  healthCheckEnabled?: boolean;
  offlineThresholdMinutes?: number;
  maintenanceSchedule?: {
    lastMaintenanceAt?: Date;
    nextMaintenanceAt?: Date;
    intervalDays?: number;
  };
  createdAt: Date;
  updatedAt: Date;
};

const deviceSchema = new Schema<DeviceDocument>(
  {
    name: { type: String, required: true, trim: true },
    gate: { type: String, enum: ["entry", "exit"], required: true },
    rtspUrl: { type: String, default: "" },
    username: { type: String, default: "" },
    password: { type: String, default: "" },
    roiNote: { type: String, default: "Biển số trước" },
    status: { type: String, enum: ["online", "offline"], default: "offline" },
    barrierStatus: { type: String, enum: ["open", "closed"], default: "closed" },
    lastSnapshotUrl: { type: String, default: "" },
    lastSnapshotAt: { type: Date },
    healthCheckEnabled: { type: Boolean, default: true },
    offlineThresholdMinutes: { type: Number, default: 30 },
    maintenanceSchedule: {
      lastMaintenanceAt: { type: Date },
      nextMaintenanceAt: { type: Date },
      intervalDays: { type: Number, default: 30 },
    },
  },
  { timestamps: true },
);

export const Device: Model<DeviceDocument> =
  mongoose.models.Device ||
  mongoose.model<DeviceDocument>("Device", deviceSchema);

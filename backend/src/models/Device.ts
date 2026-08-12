import mongoose, { Model, Schema } from "mongoose";

export type MaintenanceSchedule = {
  intervalDays: number;
  lastMaintenanceAt?: Date;
  nextMaintenanceAt?: Date;
};

export type LaneDivider = {
  start: [number, number];
  end: [number, number];
};

export type DeviceDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  gate: "entry" | "exit";
  rtspUrl: string;
  username?: string;
  password?: string;
  roiNote?: string;
  roi?: unknown;
  autoScanEnabled?: boolean;
  autoScanIntervalSeconds?: number;
  status: "online" | "offline" | "unknown";
  lastSnapshotUrl?: string;
  lastSnapshotAt?: Date;
  maintenanceSchedule?: MaintenanceSchedule;
  laneDividers?: LaneDivider[];
  healthCheckEnabled: boolean;
  offlineThresholdMinutes: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const deviceSchema = new Schema<DeviceDocument>(
  {
    name: { type: String, required: true, trim: true },
    gate: { type: String, enum: ["entry", "exit"], required: true, index: true },
    rtspUrl: { type: String, required: true, trim: true },
    username: { type: String },
    password: { type: String },
    roiNote: { type: String },
    roi: { type: Schema.Types.Mixed },
    autoScanEnabled: { type: Boolean, default: false },
    autoScanIntervalSeconds: { type: Number, default: 10, min: 1 },
    status: { type: String, enum: ["online", "offline", "unknown"], default: "unknown" },
    lastSnapshotUrl: { type: String },
    lastSnapshotAt: { type: Date },
    maintenanceSchedule: {
      type: new Schema(
        {
          intervalDays: { type: Number, default: 30 },
          lastMaintenanceAt: { type: Date },
          nextMaintenanceAt: { type: Date },
        },
        { _id: false },
      ),
    },
    laneDividers: {
      type: [
        new Schema(
          {
            start: { type: [Number], required: true },
            end: { type: [Number], required: true },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    healthCheckEnabled: { type: Boolean, default: true },
    offlineThresholdMinutes: { type: Number, default: 30 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const Device: Model<DeviceDocument> =
  mongoose.models.Device || mongoose.model<DeviceDocument>("Device", deviceSchema);

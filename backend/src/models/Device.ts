import mongoose, { Model, Schema } from "mongoose";

export type DeviceDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  gate: "entry" | "exit";
  rtspUrl?: string;
  httpUrl?: string;
  username?: string;
  password?: string;
  deviceType?: "rtsp" | "http" | "onvif" | "usb";
  roiNote?: string;
  roi?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    label?: string;
    updatedAt?: Date;
  };
  snapshotPath?: string;
  streamPath?: string;
  status: "online" | "offline";
  lastSnapshotUrl?: string;
  lastSnapshotAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  maintenanceSchedule?: {
    intervalDays?: number;
    lastMaintenanceAt?: Date;
    nextMaintenanceAt?: Date;
  };
  offlineThresholdMinutes?: number;
  healthCheckEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const deviceSchema = new Schema<DeviceDocument>(
  {
    name: { type: String, required: true, trim: true },
    gate: { type: String, enum: ["entry", "exit"], required: true },
    rtspUrl: { type: String, default: "" },
    httpUrl: { type: String, default: "" },
    username: { type: String, default: "" },
    password: { type: String, default: "" },
    deviceType: { type: String, enum: ["rtsp", "http", "onvif", "usb"], default: "rtsp" },
    roiNote: { type: String, default: "Biển số trước" },
    roi: {
      x: { type: Number, min: 0 },
      y: { type: Number, min: 0 },
      width: { type: Number, min: 1 },
      height: { type: Number, min: 1 },
      label: { type: String, trim: true },
      updatedAt: { type: Date },
    },
    snapshotPath: { type: String, default: "" },
    streamPath: { type: String, default: "" },
    status: { type: String, enum: ["online", "offline"], default: "offline" },
    lastSnapshotUrl: { type: String, default: "" },
    lastSnapshotAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    maintenanceSchedule: {
      intervalDays: { type: Number, default: 30 },
      lastMaintenanceAt: { type: Date },
      nextMaintenanceAt: { type: Date },
    },
    offlineThresholdMinutes: { type: Number, default: 30 },
    healthCheckEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Device: Model<DeviceDocument> =
  mongoose.models.Device ||
  mongoose.model<DeviceDocument>("Device", deviceSchema);

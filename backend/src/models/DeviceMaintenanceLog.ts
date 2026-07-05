import mongoose, { Schema, Document, Model } from "mongoose";

export interface DeviceMaintenanceLogDocument extends Document {
  deviceId: mongoose.Types.ObjectId;
  deviceName: string;
  type: "scheduled" | "repair" | "inspection" | "replacement";
  description: string;
  performedBy?: mongoose.Types.ObjectId;
  performedAt: Date;
  cost: number;
  notes?: string;
  status: "planned" | "in_progress" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

const deviceMaintenanceLogSchema = new Schema<DeviceMaintenanceLogDocument>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true },
    deviceName: { type: String, required: true },
    type: {
      type: String,
      enum: ["scheduled", "repair", "inspection", "replacement"],
      required: true,
    },
    description: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    performedAt: { type: Date, required: true, default: Date.now },
    cost: { type: Number, required: true, default: 0 },
    notes: { type: String },
    status: {
      type: String,
      enum: ["planned", "in_progress", "completed"],
      default: "completed",
    },
  },
  { timestamps: true }
);

export const DeviceMaintenanceLog: Model<DeviceMaintenanceLogDocument> =
  mongoose.models.DeviceMaintenanceLog ||
  mongoose.model<DeviceMaintenanceLogDocument>(
    "DeviceMaintenanceLog",
    deviceMaintenanceLogSchema
  );

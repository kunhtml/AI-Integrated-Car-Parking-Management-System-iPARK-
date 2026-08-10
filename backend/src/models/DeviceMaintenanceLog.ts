import mongoose, { Model, Schema } from "mongoose";

export type MaintenanceType = "scheduled" | "repair" | "inspection" | "replacement";
export type MaintenanceLogStatus = "planned" | "in_progress" | "completed";

export type DeviceMaintenanceLogDocument = {
  _id: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  deviceName: string;
  type: MaintenanceType;
  description: string;
  performedBy?: mongoose.Types.ObjectId;
  performedAt: Date;
  cost: number;
  notes?: string;
  status: MaintenanceLogStatus;
  createdAt: Date;
  updatedAt: Date;
};

const deviceMaintenanceLogSchema = new Schema<DeviceMaintenanceLogDocument>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true, index: true },
    deviceName: { type: String, required: true },
    type: { type: String, enum: ["scheduled", "repair", "inspection", "replacement"], required: true },
    description: { type: String, required: true, trim: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    performedAt: { type: Date, required: true },
    cost: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["planned", "in_progress", "completed"],
      default: "planned",
    },
  },
  { timestamps: true },
);

export const DeviceMaintenanceLog: Model<DeviceMaintenanceLogDocument> =
  mongoose.models.DeviceMaintenanceLog ||
  mongoose.model<DeviceMaintenanceLogDocument>("DeviceMaintenanceLog", deviceMaintenanceLogSchema);

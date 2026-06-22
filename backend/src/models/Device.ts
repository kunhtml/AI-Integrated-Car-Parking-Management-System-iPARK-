import mongoose, { Model, Schema } from "mongoose";

export type DeviceDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  gate: "entry" | "exit";
  status: "online" | "offline";
  lastSnapshotUrl?: string;
  lastSnapshotAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const deviceSchema = new Schema<DeviceDocument>(
  {
    name: { type: String, required: true, trim: true },
    gate: { type: String, enum: ["entry", "exit"], required: true },
    status: { type: String, enum: ["online", "offline"], default: "offline" },
    lastSnapshotUrl: { type: String },
    lastSnapshotAt: { type: Date },
  },
  { timestamps: true },
);

export const Device: Model<DeviceDocument> =
  mongoose.models.Device || mongoose.model<DeviceDocument>("Device", deviceSchema);

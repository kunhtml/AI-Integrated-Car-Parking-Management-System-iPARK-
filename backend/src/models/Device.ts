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
  lastSnapshotUrl?: string;
  lastSnapshotAt?: Date;
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
    lastSnapshotUrl: { type: String, default: "" },
    lastSnapshotAt: { type: Date },
  },
  { timestamps: true },
);

export const Device: Model<DeviceDocument> =
  mongoose.models.Device ||
  mongoose.model<DeviceDocument>("Device", deviceSchema);

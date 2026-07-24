import mongoose, { Model, Schema } from "mongoose";

export type IncidentType =
  | "Xe blacklist"
  | "Loi nhan dang"
  | "Yeu cau mien phi"
  | "Camera offline"
  | "Gian lan"
  | "Xu ly vu viec"
  | "Khac";

export type IncidentStatus = "Moi" | "Dang xu ly" | "Da xu ly";

export type IncidentDocument = {
  _id: mongoose.Types.ObjectId;
  type: IncidentType;
  plate?: string;
  note: string;
  status: IncidentStatus;
  sessionId?: mongoose.Types.ObjectId;
  deviceId?: mongoose.Types.ObjectId;
  reportedBy?: mongoose.Types.ObjectId;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
};

const incidentSchema = new Schema<IncidentDocument>(
  {
    type: {
      type: String,
      enum: [
        "Xe blacklist",
        "Loi nhan dang",
        "Yeu cau mien phi",
        "Camera offline",
        "Gian lan",
        "Xu ly vu viec",
        "Khac",
      ],
      required: true,
      index: true,
    },
    plate: { type: String, trim: true, uppercase: true },
    note: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Moi", "Dang xu ly", "Da xu ly"],
      default: "Moi",
      index: true,
    },
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession" },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device" },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolution: { type: String, trim: true },
  },
  { timestamps: true },
);

incidentSchema.index({ createdAt: -1 });

export const Incident: Model<IncidentDocument> =
  mongoose.models.Incident ||
  mongoose.model<IncidentDocument>("Incident", incidentSchema);

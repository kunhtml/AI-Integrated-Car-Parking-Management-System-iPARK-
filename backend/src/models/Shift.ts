import mongoose, { Model, Schema } from "mongoose";

export type ShiftDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  staffId: mongoose.Types.ObjectId;
  startAt: Date;
  endAt?: Date;
  status: "Đang làm" | "Đã kết thúc";
  note?: string;
  totalSessions?: number;
  totalRevenue?: number;
  totalIncidents?: number;
  deviceId?: mongoose.Types.ObjectId;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
};

const shiftSchema = new Schema<ShiftDocument>(
  {
    name: { type: String, required: true, trim: true },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startAt: { type: Date, default: Date.now },
    endAt: { type: Date },
    status: { type: String, enum: ["Đang làm", "Đã kết thúc"], default: "Đang làm" },
    note: { type: String },
    totalSessions: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalIncidents: { type: Number, default: 0 },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device" },
    location: { type: String },
  },
  { timestamps: true },
);

shiftSchema.index({ status: 1 });
shiftSchema.index({ startAt: -1 });

export const Shift: Model<ShiftDocument> =
  mongoose.models.Shift || mongoose.model<ShiftDocument>("Shift", shiftSchema);

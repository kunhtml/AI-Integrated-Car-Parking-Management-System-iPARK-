import mongoose, { Model, Schema } from "mongoose";

export type IncidentDocument = {
  _id: mongoose.Types.ObjectId;
  type: "Xe blacklist" | "Lỗi nhận dạng" | "Yêu cầu miễn phạt" | "Camera offline" | "Khác";
  note: string;
  plate?: string;
  sessionId?: mongoose.Types.ObjectId;
  status: "Mới" | "Đang xử lý" | "Đã xử lý";
  createdBy?: mongoose.Types.ObjectId;
  handledBy?: mongoose.Types.ObjectId;
  handledAt?: Date;
  isRecurring: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const incidentSchema = new Schema<IncidentDocument>(
  {
    type: {
      type: String,
      enum: ["Xe blacklist", "Lỗi nhận dạng", "Yêu cầu miễn phạt", "Camera offline", "Khác"],
      required: true,
    },
    note: { type: String, required: true, trim: true },
    plate: { type: String, trim: true, uppercase: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession" },
    status: { type: String, enum: ["Mới", "Đang xử lý", "Đã xử lý"], default: "Mới" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    handledBy: { type: Schema.Types.ObjectId, ref: "User" },
    handledAt: { type: Date },
    isRecurring: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ plate: 1 }, { sparse: true });
incidentSchema.index({ sessionId: 1 }, { sparse: true });

export const Incident: Model<IncidentDocument> =
  mongoose.models.Incident || mongoose.model<IncidentDocument>("Incident", incidentSchema);

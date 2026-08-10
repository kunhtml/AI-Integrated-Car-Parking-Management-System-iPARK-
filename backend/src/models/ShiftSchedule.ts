import mongoose, { Model, Schema } from "mongoose";

export type ShiftScheduleDocument = {
  _id: mongoose.Types.ObjectId;
  staffId: mongoose.Types.ObjectId;
  date: Date;
  shiftType: "morning" | "afternoon" | "evening" | "night";
  startTime: string;
  endTime: string;
  status: "scheduled" | "checked_in" | "completed" | "cancelled";
  assignedBy?: mongoose.Types.ObjectId;
  note?: string;
  location?: string;
  deviceId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const shiftScheduleSchema = new Schema<ShiftScheduleDocument>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true, index: true },
    shiftType: {
      type: String,
      enum: ["morning", "afternoon", "evening", "night"],
      required: true,
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ["scheduled", "checked_in", "completed", "cancelled"],
      default: "scheduled",
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    note: { type: String },
    location: { type: String },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device" },
  },
  { timestamps: true },
);

// Compound index for efficient queries
shiftScheduleSchema.index({ staffId: 1, date: 1 });
shiftScheduleSchema.index({ date: 1, shiftType: 1 });

export const ShiftSchedule: Model<ShiftScheduleDocument> =
  mongoose.models.ShiftSchedule || mongoose.model<ShiftScheduleDocument>("ShiftSchedule", shiftScheduleSchema);

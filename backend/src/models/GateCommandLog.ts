import mongoose, { Model, Schema } from "mongoose";

export type GateCommandLogDocument = {
  _id: mongoose.Types.ObjectId;
  /** "in" = cổng vào, "out" = cổng ra */
  gate: "in" | "out";
  /** "open" | "close" */
  command: "open" | "close";
  /** Nguồn phát sinh lệnh: auto (RFID/OCR), manual (staff qua backend), bridge, unknown */
  source: string;
  /** Phiên đỗ xe liên quan (nếu có) */
  sessionId?: mongoose.Types.ObjectId;
  /** Biển số xe (nếu AI service gửi kèm) */
  plate?: string;
  /** Lệnh gửi xuống ESP32 có thành công không */
  success: boolean;
  /** Ghi chú thêm */
  message?: string;
  createdAt: Date;
  updatedAt: Date;
};

const gateCommandLogSchema = new Schema<GateCommandLogDocument>(
  {
    gate: {
      type: String,
      enum: ["in", "out"],
      required: true,
      index: true,
    },
    command: {
      type: String,
      enum: ["open", "close"],
      required: true,
      index: true,
    },
    source: { type: String, required: true, trim: true, index: true },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "ParkingSession",
      index: true,
    },
    plate: { type: String, trim: true, uppercase: true, default: "" },
    success: { type: Boolean, default: true },
    message: { type: String, default: "" },
  },
  { timestamps: true },
);

gateCommandLogSchema.index({ createdAt: -1 });

export const GateCommandLog: Model<GateCommandLogDocument> =
  mongoose.models.GateCommandLog ||
  mongoose.model<GateCommandLogDocument>("GateCommandLog", gateCommandLogSchema);

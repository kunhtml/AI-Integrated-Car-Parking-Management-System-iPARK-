import mongoose, { Model, Schema } from "mongoose";

export type ShiftStatus = "Dang mo" | "Da dong";

export type ShiftDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  startedBy?: mongoose.Types.ObjectId;
  startAt: Date;
  endAt?: Date;
  endedBy?: mongoose.Types.ObjectId;
  status: ShiftStatus;
  note?: string;
  cashCollected: number;
  cashExpected: number;
  transactionCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const shiftSchema = new Schema<ShiftDocument>(
  {
    name: { type: String, required: true, trim: true },
    startedBy: { type: Schema.Types.ObjectId, ref: "User" },
    startAt: { type: Date, default: Date.now },
    endAt: { type: Date },
    endedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["Dang mo", "Da dong"],
      default: "Dang mo",
      index: true,
    },
    note: { type: String, trim: true },
    cashCollected: { type: Number, default: 0 },
    cashExpected: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

shiftSchema.index({ createdAt: -1 });

export const Shift: Model<ShiftDocument> =
  mongoose.models.Shift ||
  mongoose.model<ShiftDocument>("Shift", shiftSchema);

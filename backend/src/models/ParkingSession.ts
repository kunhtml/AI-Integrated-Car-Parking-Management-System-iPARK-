import mongoose, { Model, Schema } from "mongoose";

export type ParkingSessionDocument = {
  _id: mongoose.Types.ObjectId;
  licensePlate: string;
  checkInAt: Date;
  checkOutAt?: Date;
  zone?: string;
  slot?: string;
  fee?: number;
  paid?: boolean;
  status: "active" | "checked_out" | "cancelled";
  cameraId?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const parkingSessionSchema = new Schema<ParkingSessionDocument>(
  {
    licensePlate: { type: String, required: true, trim: true, index: true },
    checkInAt: { type: Date, required: true, default: () => new Date() },
    checkOutAt: { type: Date },
    zone: { type: String },
    slot: { type: String },
    fee: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "checked_out", "cancelled"], default: "active" },
    cameraId: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const ParkingSession: Model<ParkingSessionDocument> =
  mongoose.models.ParkingSession || mongoose.model<ParkingSessionDocument>("ParkingSession", parkingSessionSchema);

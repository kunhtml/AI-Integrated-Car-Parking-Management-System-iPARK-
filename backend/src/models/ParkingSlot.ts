import mongoose, { Model, Schema, Document } from "mongoose";

export interface ParkingSlotDocument extends Document {
  _id: mongoose.Types.ObjectId;
  slotNumber: string;
  zoneId: mongoose.Types.ObjectId;
  status: "empty" | "occupied" | "reserved";
  createdAt: Date;
  updatedAt: Date;
}

const parkingSlotSchema = new Schema<ParkingSlotDocument>(
  {
    slotNumber: { type: String, required: true, unique: true },
    zoneId: { type: Schema.Types.ObjectId, ref: "Zone", required: true },
    status: { type: String, enum: ["empty", "occupied", "reserved"], default: "empty" },
  },
  { timestamps: true }
);

export const ParkingSlot: Model<ParkingSlotDocument> =
  mongoose.models.ParkingSlot ||
  mongoose.model<ParkingSlotDocument>("ParkingSlot", parkingSlotSchema);

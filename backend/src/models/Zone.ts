import mongoose, { Model, Schema } from "mongoose";

export type ZoneDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  capacity: number;
  allowedVehicleTypes: string[];
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const zoneSchema = new Schema<ZoneDocument>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    allowedVehicleTypes: { type: [String], required: true, default: ["Ô tô"] },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Zone: Model<ZoneDocument> =
  mongoose.models.Zone || mongoose.model<ZoneDocument>("Zone", zoneSchema);

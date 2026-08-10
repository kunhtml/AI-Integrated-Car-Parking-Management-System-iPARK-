import mongoose, { Model, Schema } from "mongoose";

export type CapacityConfigDocument = {
  _id: mongoose.Types.ObjectId;
  key: string;
  globalCapacity: number;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const capacityConfigSchema = new Schema<CapacityConfigDocument>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    globalCapacity: { type: Number, required: true, min: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const CapacityConfig: Model<CapacityConfigDocument> =
  mongoose.models.CapacityConfig ||
  mongoose.model<CapacityConfigDocument>("CapacityConfig", capacityConfigSchema);

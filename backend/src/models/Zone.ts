import mongoose, { Model, Schema } from "mongoose";

export type LaneDivider = {
  start: [number, number];
  end: [number, number];
};

export type ZoneDocument = {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  capacity: number;
  walkInQuota: number;
  subscriberQuota: number;
  allowedVehicleTypes: string[];
  pricingConfigId?: mongoose.Types.ObjectId;
  displayOrder: number;
  isActive: boolean;
  cameraId?: mongoose.Types.ObjectId;
  laneDividers?: LaneDivider[];
  createdAt: Date;
  updatedAt: Date;
};

const zoneSchema = new Schema<ZoneDocument>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    walkInQuota: { type: Number, required: true, default: 0, min: 0 },
    subscriberQuota: { type: Number, required: true, default: 0, min: 0 },
    allowedVehicleTypes: { type: [String], required: true, default: ["Ô tô"], maxlength: 10 },
    pricingConfigId: { type: Schema.Types.ObjectId, ref: "PricingConfig" },
    displayOrder: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, required: true, default: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, ref: "Device" },
    laneDividers: {
      type: [
        new Schema(
          {
            start: { type: [Number], required: true },
            end: { type: [Number], required: true },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
  },
  { timestamps: true },
);

export const Zone: Model<ZoneDocument> =
  mongoose.models.Zone || mongoose.model<ZoneDocument>("Zone", zoneSchema);

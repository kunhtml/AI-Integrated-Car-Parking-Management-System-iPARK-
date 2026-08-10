import mongoose, { Model, Schema } from "mongoose";

export type VehicleRequestDocument = {
  _id: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: "edit" | "delete";
  status: "pending" | "approved" | "rejected";
  requestedChanges?: {
    plate?: string;
    ownerName?: string;
    ownerPhone?: string;
    ownerAddress?: string;
    brand?: string;
    model?: string;
    color?: string;
    year?: number;
    engineNo?: string;
    chassisNo?: string;
  };
  reason?: string;
  adminNote?: string;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const vehicleRequestSchema = new Schema<VehicleRequestDocument>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["edit", "delete"], required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    requestedChanges: { type: Schema.Types.Mixed },
    reason: { type: String, trim: true },
    adminNote: { type: String, trim: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

vehicleRequestSchema.index({ userId: 1, status: 1 });
vehicleRequestSchema.index({ subscriptionId: 1, vehicleId: 1, type: 1, status: 1 });

export const VehicleRequest: Model<VehicleRequestDocument> =
  mongoose.models.VehicleRequest || mongoose.model<VehicleRequestDocument>("VehicleRequest", vehicleRequestSchema);

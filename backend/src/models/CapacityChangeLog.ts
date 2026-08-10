import mongoose, { Model, Schema } from "mongoose";

export type CapacityChangeLogDocument = {
  _id: mongoose.Types.ObjectId;
  entityType: "global" | "zone";
  zoneId?: mongoose.Types.ObjectId;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changedBy?: mongoose.Types.ObjectId;
  changedAt: Date;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
};

const capacityChangeLogSchema = new Schema<CapacityChangeLogDocument>(
  {
    entityType: { type: String, enum: ["global", "zone"], required: true, index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: "Zone", index: true },
    before: { type: Schema.Types.Mixed, required: true },
    after: { type: Schema.Types.Mixed, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, required: true, default: Date.now },
    reason: { type: String, trim: true },
  },
  { timestamps: true },
);

capacityChangeLogSchema.index({ entityType: 1, zoneId: 1, changedAt: -1 });

export const CapacityChangeLog: Model<CapacityChangeLogDocument> =
  mongoose.models.CapacityChangeLog ||
  mongoose.model<CapacityChangeLogDocument>("CapacityChangeLog", capacityChangeLogSchema);

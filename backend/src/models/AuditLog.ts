import mongoose, { Model, Schema } from "mongoose";

export type AuditLogDocument = {
  _id: mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  performedBy: mongoose.Types.ObjectId;
  changes?: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
};

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    changes: {
      old: { type: Schema.Types.Mixed },
      new: { type: Schema.Types.Mixed },
    },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ entityType: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog: Model<AuditLogDocument> =
  mongoose.models.AuditLog ||
  mongoose.model<AuditLogDocument>("AuditLog", auditLogSchema);

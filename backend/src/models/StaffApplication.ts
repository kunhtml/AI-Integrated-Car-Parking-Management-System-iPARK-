import mongoose, { Model, Schema } from "mongoose";

export const STAFF_APPLICATION_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

export const STAFF_APPLICATION_SHIFTS = [
  "morning",
  "afternoon",
  "night",
  "flexible",
] as const;

export type StaffApplicationStatus =
  (typeof STAFF_APPLICATION_STATUSES)[number];
export type StaffApplicationShift =
  (typeof STAFF_APPLICATION_SHIFTS)[number];

export type StaffApplicationDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  phone?: string;
  idCardNumber?: string;
  address?: string;
  experience?: string;
  reason?: string;
  preferredShift?: StaffApplicationShift;
  status: StaffApplicationStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  submittedAt?: Date;
  resubmittedAt?: Date;
  resubmitCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const staffApplicationSchema = new Schema<StaffApplicationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    phone: { type: String, trim: true, maxlength: 20 },
    idCardNumber: { type: String, trim: true, maxlength: 12 },
    address: { type: String, trim: true, maxlength: 255 },
    experience: { type: String, trim: true, maxlength: 1000 },
    reason: { type: String, trim: true, maxlength: 1000 },
    preferredShift: {
      type: String,
      enum: STAFF_APPLICATION_SHIFTS,
    },
    status: {
      type: String,
      enum: STAFF_APPLICATION_STATUSES,
      default: "pending",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 1000 },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    submittedAt: { type: Date },
    resubmittedAt: { type: Date },
    resubmitCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

staffApplicationSchema.index({ userId: 1, createdAt: -1 });
staffApplicationSchema.index({ status: 1, createdAt: -1 });
staffApplicationSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

export const StaffApplication: Model<StaffApplicationDocument> =
  mongoose.models.StaffApplication ||
  mongoose.model<StaffApplicationDocument>(
    "StaffApplication",
    staffApplicationSchema,
  );

import mongoose, { Model, Schema } from "mongoose";
import {
  STAFF_APPLICATION_STATUSES,
  type StaffApplicationShift,
  type StaffApplicationStatus,
} from "./StaffApplication.js";

export const STAFF_APPLICATION_HISTORY_ACTIONS = [
  "DRAFT_CREATED",
  "SUBMITTED",
  "EDITED",
  "REJECTED",
  "RESUBMITTED",
  "APPROVED",
  "CANCELLED",
  "MIGRATED",
] as const;

export type StaffApplicationHistoryAction =
  (typeof STAFF_APPLICATION_HISTORY_ACTIONS)[number];

export type StaffApplicationSnapshot = {
  phone?: string;
  idCardNumber?: string;
  address?: string;
  experience?: string;
  reason?: string;
  preferredShift?: StaffApplicationShift;
};

export type StaffApplicationHistoryDocument = {
  _id: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: StaffApplicationHistoryAction;
  oldStatus?: StaffApplicationStatus;
  newStatus: StaffApplicationStatus;
  performedBy?: mongoose.Types.ObjectId;
  performedRole?: "customer" | "admin" | "staff";
  note?: string;
  changedFields: string[];
  before: StaffApplicationSnapshot;
  after: StaffApplicationSnapshot;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
};

const snapshotSchema = new Schema<StaffApplicationSnapshot>(
  {
    phone: String,
    idCardNumber: String,
    address: String,
    experience: String,
    reason: String,
    preferredShift: String,
  },
  { _id: false },
);

const historySchema = new Schema<StaffApplicationHistoryDocument>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "StaffApplication",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: {
      type: String,
      enum: STAFF_APPLICATION_HISTORY_ACTIONS,
      required: true,
    },
    oldStatus: { type: String, enum: [...STAFF_APPLICATION_STATUSES, undefined] },
    newStatus: { type: String, enum: STAFF_APPLICATION_STATUSES, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    performedRole: { type: String, enum: ["customer", "admin", "staff"] },
    note: { type: String, trim: true, maxlength: 2000 },
    changedFields: { type: [String], default: [] },
    before: { type: snapshotSchema, default: {} },
    after: { type: snapshotSchema, default: {} },
    sequence: { type: Number, required: true },
  },
  { timestamps: true },
);

historySchema.index({ applicationId: 1, sequence: 1 }, { unique: true });
historySchema.index({ userId: 1, createdAt: -1 });

export const StaffApplicationHistory: Model<StaffApplicationHistoryDocument> =
  mongoose.models.StaffApplicationHistory ||
  mongoose.model<StaffApplicationHistoryDocument>(
    "StaffApplicationHistory",
    historySchema,
  );

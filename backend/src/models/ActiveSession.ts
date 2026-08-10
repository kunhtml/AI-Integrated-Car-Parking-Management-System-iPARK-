import mongoose, { Model, Schema } from "mongoose";

export type ActiveSessionDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userAgent?: string | null;
  ipAddress?: string | null;
  loginAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const activeSessionSchema = new Schema<ActiveSessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
    loginAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, expires: 0 },
    isRevoked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const ActiveSession: Model<ActiveSessionDocument> =
  mongoose.models.ActiveSession ||
  mongoose.model<ActiveSessionDocument>("ActiveSession", activeSessionSchema);

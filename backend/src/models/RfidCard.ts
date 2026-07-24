import mongoose, { Model, Schema } from "mongoose";

export type RfidCardDocument = {
  _id: mongoose.Types.ObjectId;
  cardId: string;
  status: "available" | "in-use" | "lost" | "blocked";
  issuedAt: Date;
  lastUsedAt?: Date;
  lostAt?: Date;
  blockedAt?: Date;
  blockedReason?: string;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const rfidCardSchema = new Schema<RfidCardDocument>(
  {
    cardId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ["available", "in-use", "lost", "blocked"],
      default: "available",
      index: true,
    },
    issuedAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date },
    lostAt: { type: Date },
    blockedAt: { type: Date },
    blockedReason: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const RfidCard: Model<RfidCardDocument> =
  mongoose.models.RfidCard ||
  mongoose.model<RfidCardDocument>("RfidCard", rfidCardSchema);

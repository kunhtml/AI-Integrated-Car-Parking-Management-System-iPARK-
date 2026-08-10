import mongoose, { Model, Schema } from "mongoose";

export type RfidCardDocument = {
  _id: mongoose.Types.ObjectId;
  uid: string;
  ownerName: string;
  plate: string;
  userType: "resident" | "guest";
  status: "active" | "inactive";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

const rfidCardSchema = new Schema<RfidCardDocument>(
  {
    uid: { type: String, required: true, unique: true, trim: true, index: true },
    ownerName: { type: String, required: true, trim: true, default: "Guest" },
    plate: { type: String, trim: true, uppercase: true, default: "" },
    userType: {
      type: String,
      enum: ["resident", "guest"],
      default: "guest",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

rfidCardSchema.index({ plate: 1 });

export const RfidCard: Model<RfidCardDocument> =
  mongoose.models.RfidCard || mongoose.model<RfidCardDocument>("RfidCard", rfidCardSchema);
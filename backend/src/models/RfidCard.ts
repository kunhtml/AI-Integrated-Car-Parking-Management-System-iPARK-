import mongoose, { Model, Schema } from "mongoose";

export type RfidCardStatus =
  | "active"
  | "inactive"
  | "available"
  | "pending-sale"
  | "in-use"
  | "lost"
  | "blocked"
  | "damaged"
  | "returned";

/**
 * Guest: thẻ tạm thuộc kho bãi, giao khi vào và thu hồi khi ra.
 * Member: thẻ bán đứt cho một xe cụ thể; không được trả về kho.
 */
export type RfidCardType = "guest" | "member";

export type RfidCardDocument = {
  _id: mongoose.Types.ObjectId;
  uid: string;
  cardId?: string;
  createdBy?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  replacementOf?: mongoose.Types.ObjectId;
  replacedBy?: mongoose.Types.ObjectId;
  pendingTransactionId?: mongoose.Types.ObjectId;
  ownerName: string;
  plate: string;
  userType: "resident" | "guest";
  cardType: RfidCardType;
  status: RfidCardStatus;
  salePrice?: number;
  depositAmount?: number;
  assignedAt?: Date;
  soldAt?: Date;
  returnedAt?: Date;
  lastUsedAt?: Date;
  lostAt?: Date;
  damagedAt?: Date;
  blockedAt?: Date;
  blockedReason?: string;
  damagedReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

const rfidCardSchema = new Schema<RfidCardDocument>(
  {
    uid: { type: String, required: true, unique: true, trim: true, index: true },
    cardId: { type: String, trim: true, uppercase: true, sparse: true, unique: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", index: true },
    replacementOf: { type: Schema.Types.ObjectId, ref: "RfidCard" },
    replacedBy: { type: Schema.Types.ObjectId, ref: "RfidCard" },
    pendingTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    ownerName: { type: String, required: true, trim: true, default: "Guest" },
    plate: { type: String, trim: true, uppercase: true, default: "" },
    userType: { type: String, enum: ["resident", "guest"], default: "guest", index: true },
    cardType: { type: String, enum: ["guest", "member"], default: "guest", required: true, index: true },
    status: {
      type: String,
      enum: ["active", "inactive", "available", "pending-sale", "in-use", "lost", "blocked", "damaged", "returned"],
      default: "available",
      index: true,
    },
    salePrice: { type: Number, min: 0, default: 0 },
    depositAmount: { type: Number, min: 0, default: 0 },
    assignedAt: { type: Date },
    soldAt: { type: Date },
    returnedAt: { type: Date },
    lastUsedAt: { type: Date },
    lostAt: { type: Date },
    damagedAt: { type: Date },
    blockedAt: { type: Date },
    blockedReason: { type: String, trim: true },
    damagedReason: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

rfidCardSchema.index({ plate: 1 });
rfidCardSchema.index({ vehicleId: 1, status: 1 });
rfidCardSchema.index({ userId: 1, status: 1 });
rfidCardSchema.index({ vehicleId: 1, cardType: 1, status: 1 });

export const RfidCard: Model<RfidCardDocument> =
  mongoose.models.RfidCard || mongoose.model<RfidCardDocument>("RfidCard", rfidCardSchema);

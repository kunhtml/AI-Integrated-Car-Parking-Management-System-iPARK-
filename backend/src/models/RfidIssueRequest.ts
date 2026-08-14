import mongoose, { Model, Schema } from "mongoose";

export type RfidIssueType = "lost" | "damaged";
export type RfidIssueStatus = "pending" | "processing" | "completed" | "rejected";
export type RfidIssueDocument = { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; vehicleId?: mongoose.Types.ObjectId; rfidCardId: mongoose.Types.ObjectId; uid: string; type: RfidIssueType; description?: string; status: RfidIssueStatus; handledBy?: mongoose.Types.ObjectId; handledAt?: Date; managerNote?: string; createdAt: Date; updatedAt: Date };
const schema = new Schema<RfidIssueDocument>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" }, rfidCardId: { type: Schema.Types.ObjectId, ref: "RfidCard", required: true, index: true }, uid: { type: String, required: true, trim: true }, type: { type: String, enum: ["lost", "damaged"], required: true }, description: { type: String, trim: true, maxlength: 1000 }, status: { type: String, enum: ["pending", "processing", "completed", "rejected"], default: "pending", index: true }, handledBy: { type: Schema.Types.ObjectId, ref: "User" }, handledAt: Date, managerNote: { type: String, trim: true } }, { timestamps: true });
schema.index({ userId: 1, createdAt: -1 });
export const RfidIssueRequest: Model<RfidIssueDocument> = mongoose.models.RfidIssueRequest || mongoose.model<RfidIssueDocument>("RfidIssueRequest", schema);

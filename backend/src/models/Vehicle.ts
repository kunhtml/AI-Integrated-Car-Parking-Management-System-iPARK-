import mongoose, { Model, Schema } from "mongoose";

export type VehicleDocument = {
  _id: mongoose.Types.ObjectId;
  plate: string;
  ownerName: string;
  vehicleType: "Ô tô";
  status: "Đã đăng ký" | "Cần duyệt" | "Blacklist";
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const vehicleSchema = new Schema<VehicleDocument>(
  {
    plate: { type: String, required: true, trim: true, uppercase: true, unique: true },
    ownerName: { type: String, required: true, trim: true },
    vehicleType: { type: String, enum: ["Ô tô"], required: true },
    status: { type: String, enum: ["Đã đăng ký", "Cần duyệt", "Blacklist"], default: "Cần duyệt" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const Vehicle: Model<VehicleDocument> =
  mongoose.models.Vehicle || mongoose.model<VehicleDocument>("Vehicle", vehicleSchema);

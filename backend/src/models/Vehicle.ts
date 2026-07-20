import mongoose, { Model, Schema } from "mongoose";

export type VehicleDocument = {
  _id: mongoose.Types.ObjectId;
  plate: string;
  ownerName: string;
  ownerPhone?: string;
  ownerAddress?: string;
  brand?: string;
  model?: string;
  color?: string;
  engineNo?: string;
  chassisNo?: string;
  year?: number;
  vehicleType: "Ô tô";
  status: "Đã đăng ký" | "Cần duyệt" | "Blacklist";
  isCompanyVehicle?: boolean;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const vehicleSchema = new Schema<VehicleDocument>(
  {
    plate: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    ownerName: { type: String, required: true, trim: true },
    ownerPhone: { type: String, trim: true },
    ownerAddress: { type: String, trim: true },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    color: { type: String, trim: true },
    engineNo: { type: String, trim: true },
    chassisNo: { type: String, trim: true },
    year: { type: Number },
    vehicleType: { type: String, enum: ["Ô tô"], required: true, default: "Ô tô" },
    status: { type: String, enum: ["Đã đăng ký", "Cần duyệt", "Blacklist"], default: "Cần duyệt", index: true },
    isCompanyVehicle: { type: Boolean, default: false },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true },
);

export const Vehicle: Model<VehicleDocument> =
  mongoose.models.Vehicle || mongoose.model<VehicleDocument>("Vehicle", vehicleSchema);

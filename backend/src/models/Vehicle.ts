import mongoose, { Model, Schema } from "mongoose";

export type VehicleDocument = {
  _id: mongoose.Types.ObjectId;
  plate: string;
  ownerName: string;
  ownerEmail?: string;
  ownerPhone?: string;
  ownerAddress?: string;
  vehicleType: "Ô tô";
  status: "Đã đăng ký" | "Cần duyệt" | "Blacklist";
  userId?: mongoose.Types.ObjectId;
  brand?: string;
  model?: string;
  color?: string;
  year?: number;
  engineNo?: string;
  chassisNo?: string;
  isCompanyVehicle: boolean;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

const vehicleSchema = new Schema<VehicleDocument>(
  {
    plate: { type: String, required: true, trim: true, uppercase: true, unique: true },
    ownerName: { type: String, required: true, trim: true },
    ownerEmail: { type: String, trim: true, lowercase: true },
    ownerPhone: { type: String, trim: true },
    ownerAddress: { type: String, trim: true },
    vehicleType: { type: String, enum: ["Ô tô"], required: true },
    status: { type: String, enum: ["Đã đăng ký", "Cần duyệt", "Blacklist"], default: "Cần duyệt" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    color: { type: String, trim: true },
    year: { type: Number },
    engineNo: { type: String, trim: true },
    chassisNo: { type: String, trim: true },
    isCompanyVehicle: { type: Boolean, default: false },
    imageUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

vehicleSchema.index({ userId: 1 });
vehicleSchema.index({ status: 1 });

export const Vehicle: Model<VehicleDocument> =
  mongoose.models.Vehicle || mongoose.model<VehicleDocument>("Vehicle", vehicleSchema);

import mongoose, { Model, Schema } from "mongoose";

export type DocumentType =
  | "Dang ky xe"
  | "Dang kiem"
  | "Bao hiem"
  | "Giay to khac";

export type DocumentStatus = "Cho duyet" | "Da duyet" | "Tu choi";

export type VehicleDocumentDoc = {
  _id: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  documentType: DocumentType;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  status: DocumentStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

const vehicleDocumentSchema = new Schema<VehicleDocumentDoc>(
  {
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: ["Dang ky xe", "Dang kiem", "Bao hiem", "Giay to khac"],
      required: true,
    },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Cho duyet", "Da duyet", "Tu choi"],
      default: "Cho duyet",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

vehicleDocumentSchema.index({ status: 1, createdAt: -1 });

export const VehicleDocument: Model<VehicleDocumentDoc> =
  mongoose.models.VehicleDocument ||
  mongoose.model<VehicleDocumentDoc>(
    "VehicleDocument",
    vehicleDocumentSchema,
  );

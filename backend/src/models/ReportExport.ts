import mongoose, { Model, Schema } from "mongoose";

export type ReportExportDocument = {
  _id: mongoose.Types.ObjectId;
  fileName: string;
  reportType: "revenue";
  format: "PDF" | "Excel";
  period: string;
  createdBy?: mongoose.Types.ObjectId;
  status: "Ready" | "Processing" | "Failed";
  createdAt: Date;
  updatedAt: Date;
};

const reportExportSchema = new Schema<ReportExportDocument>(
  {
    fileName: { type: String, required: true, trim: true },
    reportType: { type: String, enum: ["revenue"], default: "revenue" },
    format: { type: String, enum: ["PDF", "Excel"], required: true },
    period: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["Ready", "Processing", "Failed"], default: "Ready" },
  },
  { timestamps: true },
);

export const ReportExport: Model<ReportExportDocument> =
  mongoose.models.ReportExport || mongoose.model<ReportExportDocument>("ReportExport", reportExportSchema);

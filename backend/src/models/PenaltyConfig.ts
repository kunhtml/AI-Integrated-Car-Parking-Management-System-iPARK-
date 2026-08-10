import mongoose, { Model, Schema } from "mongoose";

// Loại lỗi đỗ xe. Hiện chỉ hỗ trợ "đỗ lấn vạch".
export type PenaltyViolationType = "over_line";

export type PenaltyConfigDocument = {
  _id: mongoose.Types.ObjectId;
  violationType: PenaltyViolationType;
  label: string; // nhãn hiển thị, vd "Đỗ lấn vạch"
  amount: number; // tiền phạt (VND)
  description?: string;
  isActive: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const penaltyConfigSchema = new Schema<PenaltyConfigDocument>(
  {
    violationType: {
      type: String,
      enum: ["over_line"],
      required: true,
      unique: true,
    },
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const PenaltyConfig: Model<PenaltyConfigDocument> =
  mongoose.models.PenaltyConfig ||
  mongoose.model<PenaltyConfigDocument>("PenaltyConfig", penaltyConfigSchema);

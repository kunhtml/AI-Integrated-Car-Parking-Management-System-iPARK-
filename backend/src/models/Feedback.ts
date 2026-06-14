import mongoose, { Model, Schema } from "mongoose";

export type FeedbackDocument = {
  _id: mongoose.Types.ObjectId;
  subject: string;
  content: string;
  status: "Đang xử lý" | "Đã phản hồi" | "Đã đóng";
  response?: string;
  createdBy?: mongoose.Types.ObjectId;
  handledBy?: mongoose.Types.ObjectId;
  handledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const feedbackSchema = new Schema<FeedbackDocument>(
  {
    subject: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Đang xử lý", "Đã phản hồi", "Đã đóng"], default: "Đang xử lý" },
    response: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    handledBy: { type: Schema.Types.ObjectId, ref: "User" },
    handledAt: { type: Date },
  },
  { timestamps: true },
);

export const Feedback: Model<FeedbackDocument> =
  mongoose.models.Feedback || mongoose.model<FeedbackDocument>("Feedback", feedbackSchema);

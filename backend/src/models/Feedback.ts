import mongoose, { Model, Schema } from "mongoose";

export type FeedbackStatus = "Moi" | "Dang xu ly" | "Da xu ly";

export type FeedbackDocument = {
  _id: mongoose.Types.ObjectId;
  subject: string;
  content: string;
  name?: string;
  phone?: string;
  email?: string;
  status: FeedbackStatus;
  response?: string;
  respondedBy?: mongoose.Types.ObjectId;
  respondedAt?: Date;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const feedbackSchema = new Schema<FeedbackDocument>(
  {
    subject: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Moi", "Dang xu ly", "Da xu ly"],
      default: "Moi",
      index: true,
    },
    response: { type: String, trim: true },
    respondedBy: { type: Schema.Types.ObjectId, ref: "User" },
    respondedAt: { type: Date },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

feedbackSchema.index({ createdAt: -1 });

export const Feedback: Model<FeedbackDocument> =
  mongoose.models.Feedback ||
  mongoose.model<FeedbackDocument>("Feedback", feedbackSchema);

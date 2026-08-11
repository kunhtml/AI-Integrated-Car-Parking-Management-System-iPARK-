import mongoose, { Model, Schema } from "mongoose";

export type DisputeMessage = {
  _id: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderRole: "customer" | "admin" | "staff";
  senderName: string;
  content: string;
  createdAt: Date;
};

export const DISPUTE_REASONS = [
  "Sai phí gửi xe",
  "Sai thời gian vào/ra",
  "Nhận dạng biển số sai",
  "Thanh toán trùng / chưa ghi nhận",
  "Hư hỏng - mất mát tài sản",
  "Thái độ phục vụ",
  "Khác",
] as const;

export const DISPUTE_STATUSES = [
  "Mới",
  "Đang xử lý",
  "Đã xử lý",
  "Từ chối",
] as const;

export type DisputeReason = (typeof DISPUTE_REASONS)[number];
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export type DisputeDocument = {
  _id: mongoose.Types.ObjectId;
  code: string;
  userId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  transactionId?: mongoose.Types.ObjectId;
  plate?: string;
  reason: DisputeReason;
  content: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  attachments: string[];
  status: DisputeStatus;
  incidentId?: mongoose.Types.ObjectId;
  resolutionNote?: string;
  handledBy?: mongoose.Types.ObjectId;
  handledAt?: Date;
  messages: DisputeMessage[];
  createdAt: Date;
  updatedAt: Date;
};

const disputeSchema = new Schema<DisputeDocument>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "ParkingSession",
      index: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      index: true,
    },
    plate: { type: String, trim: true, uppercase: true },
    reason: { type: String, enum: DISPUTE_REASONS, required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    contactName: { type: String, required: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    attachments: { type: [String], default: [] },
    status: {
      type: String,
      enum: DISPUTE_STATUSES,
      default: "Mới",
      index: true,
    },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident" },
    resolutionNote: { type: String, trim: true },
    handledBy: { type: Schema.Types.ObjectId, ref: "User" },
    handledAt: { type: Date },
    messages: {
      type: [
        new Schema<DisputeMessage>(
          {
            senderId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            senderRole: {
              type: String,
              enum: ["customer", "admin", "staff"],
              required: true,
            },
            senderName: { type: String, required: true, trim: true },
            content: {
              type: String,
              required: true,
              trim: true,
              maxlength: 2000,
            },
          },
          { timestamps: { createdAt: true, updatedAt: false } },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

disputeSchema.index({ userId: 1, createdAt: -1 });
disputeSchema.index({ status: 1, createdAt: -1 });

export const Dispute: Model<DisputeDocument> =
  mongoose.models.Dispute ||
  mongoose.model<DisputeDocument>("Dispute", disputeSchema);

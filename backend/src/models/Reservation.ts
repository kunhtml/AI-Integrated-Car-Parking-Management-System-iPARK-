import mongoose, { Model, Schema } from "mongoose";

export type ReservationStatus = "pending" | "active" | "completed" | "cancelled" | "expired";
export type ReservationCustomerType = "member" | "guest";
export type ReservationQuotaType = "member" | "walk_in";

export type ReservationDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  slotId: mongoose.Types.ObjectId;
  slotCode: string;
  zoneName: string;
  vehicleType: string;
  customerType: ReservationCustomerType;
  quotaType: ReservationQuotaType;
  plate: string;
  reservedFrom: Date;
  reservedUntil: Date;
  status: ReservationStatus;
  sessionId?: mongoose.Types.ObjectId;
  depositAmount: number;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
};

const reservationSchema = new Schema<ReservationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    slotId: { type: Schema.Types.ObjectId, ref: "ParkingSlot", required: true },
    slotCode: { type: String, required: true },
    zoneName: { type: String, required: true },
    vehicleType: { type: String, default: "Ô tô" },
    customerType: { type: String, enum: ["member", "guest"], default: "guest", required: true },
    quotaType: { type: String, enum: ["member", "walk_in"], default: "walk_in", required: true },
    plate: { type: String, required: true, uppercase: true, trim: true },
    reservedFrom: { type: Date, required: true },
    reservedUntil: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled", "expired"],
      default: "active",
      index: true,
    },
    sessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession" },
    depositAmount: { type: Number, default: 0 },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true },
);

reservationSchema.index({ userId: 1, status: 1 });
reservationSchema.index({ slotId: 1, status: 1 });
reservationSchema.index({ reservedUntil: 1, status: 1 });

export const Reservation: Model<ReservationDocument> =
  mongoose.models.Reservation ||
  mongoose.model<ReservationDocument>("Reservation", reservationSchema);

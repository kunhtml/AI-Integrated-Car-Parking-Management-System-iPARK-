import mongoose, { Model, Schema } from "mongoose";

export type SlotStatus = "empty" | "occupied" | "reserved" | "maintenance";
export type SlotType = "regular" | "VIP" | "electric" | "handicap";
// "resident" = chỉ dành cho cư dân. "guest" = chỉ dành cho khách vãng lai.
// "shared" = ưu tiên cư dân, khi rảnh khách vãng lai vẫn đậu được.
export type SlotAccessPolicy = "resident" | "guest" | "shared";

export type ParkingSlotDocument = {
  _id: mongoose.Types.ObjectId;
  slotCode: string;
  zoneId: mongoose.Types.ObjectId;
  zoneName: string;
  slotType: SlotType;
  features: string[];
  status: SlotStatus;
  currentSessionId?: mongoose.Types.ObjectId;
  floor: number;
  notes?: string;
  // Chính sách truy cập: cư dân / khách / chung
  accessPolicy: SlotAccessPolicy;
  // Polygon vùng ô đỗ trên ảnh camera, toạ độ CHUẨN HOÁ 0..1 theo (width,height).
  aiPolygon?: [number, number][];
  createdAt: Date;
  updatedAt: Date;
};

const parkingSlotSchema = new Schema<ParkingSlotDocument>(
  {
    slotCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    zoneId: { type: Schema.Types.ObjectId, ref: "Zone", required: true, index: true },
    zoneName: { type: String, required: true, trim: true },
    slotType: {
      type: String,
      enum: ["regular", "VIP", "electric", "handicap"],
      default: "regular",
    },
    features: { type: [String], default: [], maxlength: 10 },
    status: {
      type: String,
      enum: ["empty", "occupied", "reserved", "maintenance"],
      default: "empty",
      index: true,
    },
    currentSessionId: { type: Schema.Types.ObjectId, ref: "ParkingSession" },
    floor: { type: Number, required: true, default: 0 },
    notes: { type: String, trim: true },
    accessPolicy: {
      type: String,
      enum: ["resident", "guest", "shared"],
      default: "shared",
      index: true,
    },
    aiPolygon: { type: [[Number]], default: undefined },
  },
  { timestamps: true },
);

parkingSlotSchema.index({ zoneId: 1, status: 1 });
parkingSlotSchema.index({ status: 1, slotType: 1 });
parkingSlotSchema.index({ accessPolicy: 1, status: 1 });

export const ParkingSlot: Model<ParkingSlotDocument> =
  mongoose.models.ParkingSlot ||
  mongoose.model<ParkingSlotDocument>("ParkingSlot", parkingSlotSchema);

import mongoose from "mongoose";
import { ParkingSlot } from "../models/ParkingSlot.js";

export async function freeSlot(slotId: string | mongoose.Types.ObjectId) {
  await ParkingSlot.findByIdAndUpdate(slotId, { status: "empty" });
}

export async function occupySlot(slotId: string | mongoose.Types.ObjectId) {
  await ParkingSlot.findByIdAndUpdate(slotId, { status: "occupied" });
}

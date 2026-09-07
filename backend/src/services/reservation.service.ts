import mongoose from "mongoose";
import { ParkingSession } from "../models/ParkingSession.js";
import { ParkingSlot } from "../models/ParkingSlot.js";
import { Reservation, ReservationDocument, ReservationStatus } from "../models/Reservation.js";
import { createNotification } from "./notification.service.js";
import { occupySlot } from "./parkingSlot.service.js";
import { classifyVehicleByPlate, syncDynamicMemberSlotReservation } from "./parkingQuota.service.js";

export async function createReservation(params: {
  userId: string;
  slotId: string;
  plate: string;
  reservedFrom: Date;
  reservedUntil: Date;
}): Promise<ReservationDocument> {
  await syncDynamicMemberSlotReservation();
  const quotaAccess = await classifyVehicleByPlate(params.plate);
  const slot = await ParkingSlot.findById(params.slotId);
  if (!slot) {
    const err = new Error("Slot không tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  // Only allow reserving VIP/electric/handicap slots
  if (!["VIP", "electric", "handicap"].includes(slot.slotType)) {
    const err = new Error("Chỉ có thể đặt trước slot VIP, điện hoặc khuyết tật.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  if (slot.quotaType && slot.quotaType !== quotaAccess.quotaType) {
    const err = new Error("Slot không thuộc quota phù hợp với loại khách.") as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const overlap = await Reservation.findOne({
    slotId: slot._id,
    status: { $in: ["pending", "active"] },
    reservedFrom: { $lt: params.reservedUntil },
    reservedUntil: { $gt: params.reservedFrom },
  });
  if (overlap) {
    const err = new Error("Slot đã có đặt chỗ trong khoảng thời gian này.") as Error & { status: number };
    err.status = 409;
    throw err;
  }

  // ATOMIC CLAIM: find-then-update trước đây tạo race — hai request cùng lúc
  // đều thấy slot "empty" rồi cùng đặt reserved. findOneAndUpdate có điều
  // kiện status:"empty" đảm bảo CHỈ MỘT request thắng; request thua nhận null
  // → 409, không bao giờ double-reserve.
  const claimed = await ParkingSlot.findOneAndUpdate(
    { _id: slot._id, status: "empty" },
    { $set: { status: "reserved" } },
    { new: true },
  );
  if (!claimed) {
    const err = new Error("Slot này không còn trống.") as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const reservation = await Reservation.create({
    userId: new mongoose.Types.ObjectId(params.userId),
    slotId: slot._id,
    slotCode: slot.slotCode,
    zoneName: slot.zoneName,
    plate: params.plate.toUpperCase(),
    reservedFrom: params.reservedFrom,
    reservedUntil: params.reservedUntil,
    status: "active",
  });

  return reservation;
}

export async function cancelReservation(
  reservationId: string,
  userId?: string,
  reason?: string,
): Promise<ReservationDocument> {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    const err = new Error("Không tìm thấy đặt chỗ.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (!["pending", "active"].includes(reservation.status)) {
    const err = new Error("Không thể hủy đặt chỗ ở trạng thái hiện tại.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  // If customer cancelling, check ownership
  if (userId && reservation.userId.toString() !== userId) {
    const err = new Error("Bạn không có quyền hủy đặt chỗ này.") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  reservation.status = "cancelled";
  reservation.cancelledAt = new Date();
  reservation.cancelReason = reason || "Hủy bởi người dùng";
  await reservation.save();

  // Free the slot
  await ParkingSlot.findByIdAndUpdate(reservation.slotId, {
    $set: { status: "empty" },
    $unset: { currentSessionId: "" },
  });

  return reservation;
}

export async function confirmArrival(
  reservationId: string,
  staffUserId: string,
): Promise<{ reservation: ReservationDocument; sessionId: string }> {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    const err = new Error("Không tìm thấy đặt chỗ.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (reservation.status !== "active") {
    const err = new Error("Đặt chỗ không ở trạng thái active.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  // Create parking session; reservation remains member/walk-in consistent.
  const quotaAccess = await classifyVehicleByPlate(reservation.plate);
  const session = await ParkingSession.create({
    plate: reservation.plate,
    ownerName: "Khách đặt trước",
    vehicleType: "Ô tô" as const,
    slot: reservation.slotCode,
    slotId: reservation.slotId,
    ownerUserId: reservation.userId,
    createdBy: new mongoose.Types.ObjectId(staffUserId),
  });

  // Mark slot as occupied
  await occupySlot(reservation.slotId, session._id);

  reservation.status = "completed";
  reservation.sessionId = session._id;
  await reservation.save();

  return { reservation, sessionId: session._id.toString() };
}

export async function expireOverdueReservations(): Promise<number> {
  const now = new Date();
  const overdue = await Reservation.find({
    status: "active",
    reservedUntil: { $lt: now },
  });

  let count = 0;
  for (const reservation of overdue) {
    reservation.status = "expired";
    await reservation.save();
    await ParkingSlot.findByIdAndUpdate(reservation.slotId, {
      $set: { status: "empty" },
      $unset: { currentSessionId: "" },
    });
    count++;
  }

  if (count > 0) {
    await createNotification({
      title: "Đặt chỗ hết hạn",
      content: `${count} đặt chỗ đã hết hạn và được tự động hủy.`,
      targetRole: "admin",
    });
  }

  return count;
}

export async function listUserReservations(userId: string): Promise<ReservationDocument[]> {
  return Reservation.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 });
}

export async function listAllReservations(filters?: {
  status?: ReservationStatus;
}): Promise<ReservationDocument[]> {
  const query: Record<string, unknown> = {};
  if (filters?.status) query.status = filters.status;
  return Reservation.find(query).sort({ createdAt: -1 }).limit(200);
}

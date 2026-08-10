import { Request, Response } from "express";
import { z } from "zod";
import {
  cancelReservation,
  confirmArrival,
  createReservation,
  expireOverdueReservations,
  listAllReservations,
  listUserReservations,
} from "../services/reservation.service.js";
import { serializeReservation } from "../utils/serializers.js";

export async function listReservationsHandler(request: Request, response: Response) {
  const status = request.query.status as string | undefined;
  const reservations = await listAllReservations(status ? { status: status as any } : undefined);
  response.json({ reservations: reservations.map(serializeReservation) });
}

export async function myReservationsHandler(request: Request, response: Response) {
  const reservations = await listUserReservations(request.user!.id);
  response.json({ reservations: reservations.map(serializeReservation) });
}

export async function createReservationHandler(request: Request, response: Response) {
  const body = z
    .object({
      slotId: z.string().min(1),
      plate: z.string().min(5),
      reservedFrom: z.string().min(1),
      reservedUntil: z.string().min(1),
    })
    .parse(request.body);

  const reservation = await createReservation({
    userId: request.user!.id,
    slotId: body.slotId,
    plate: body.plate,
    reservedFrom: new Date(body.reservedFrom),
    reservedUntil: new Date(body.reservedUntil),
  });

  response.status(201).json({ reservation: serializeReservation(reservation) });
}

export async function cancelReservationHandler(request: Request, response: Response) {
  const body = z.object({ reason: z.string().optional() }).parse(request.body);
  const userId = request.user!.role === "customer" ? request.user!.id : undefined;
  const reservation = await cancelReservation(String(request.params.id), userId, body.reason);
  response.json({ reservation: serializeReservation(reservation), message: "Đã hủy đặt chỗ." });
}

export async function confirmReservationHandler(request: Request, response: Response) {
  const { reservation, sessionId } = await confirmArrival(String(request.params.id), request.user!.id);
  response.json({
    reservation: serializeReservation(reservation),
    sessionId,
    message: "Đã xác nhận xe tới, phiên đỗ đã được tạo.",
  });
}

export async function expireReservationsHandler(_request: Request, response: Response) {
  const count = await expireOverdueReservations();
  response.json({ expired: count, message: `${count} đặt chỗ đã hết hạn.` });
}

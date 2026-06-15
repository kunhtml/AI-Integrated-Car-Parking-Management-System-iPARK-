import { Request, Response } from "express";
import { z } from "zod";
import { ParkingSession } from "../models/ParkingSession.js";
import { serializeParkingSession } from "../utils/serializers.js";

export async function overviewSessions(_request: Request, response: Response) {
  // simple overview: counts and some active sessions
  const total = await ParkingSession.countDocuments({});
  const active = await ParkingSession.countDocuments({ status: "active" });
  const checkedOut = await ParkingSession.countDocuments({ status: "checked_out" });
  const recent = await ParkingSession.find({}).sort({ createdAt: -1 }).limit(10);

  response.json({ ok: true, data: { total, active, checkedOut, recent: recent.map(serializeParkingSession) } });
}

export async function listSessions(request: Request, response: Response) {
  const q = request.query.q ? String(request.query.q) : undefined;
  const criteria: any = {};
  if (q) {
    criteria.licensePlate = { $regex: q, $options: "i" };
  }
  const sessions = await ParkingSession.find(criteria).sort({ createdAt: -1 }).limit(200);
  response.json({ sessions: sessions.map(serializeParkingSession) });
}

export async function updateSession(request: Request, response: Response) {
  const body = z.object({ status: z.enum(["active", "checked_out", "cancelled"]).optional(), paid: z.boolean().optional(), fee: z.number().optional() }).parse(request.body);
  const session = await ParkingSession.findByIdAndUpdate(request.params.id, { ...body }, { new: true });
  if (!session) {
    response.status(404).json({ message: "Không tìm thấy phiên gửi xe." });
    return;
  }
  response.json({ session: serializeParkingSession(session) });
}

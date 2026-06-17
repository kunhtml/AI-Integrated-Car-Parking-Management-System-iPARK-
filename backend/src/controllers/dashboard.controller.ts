import { Request, Response } from "express";
import { ParkingSession } from "../models/ParkingSession.js";

export async function getDashboardOverview(_request: Request, response: Response) {
  const [total, active, completed, paidSessions] = await Promise.all([
    ParkingSession.countDocuments({}),
    ParkingSession.countDocuments({ status: "active" }),
    ParkingSession.countDocuments({ status: "checked_out" }),
    ParkingSession.find({ status: "checked_out", paid: true }).select("fee").lean(),
  ]);

  const revenue = paidSessions.reduce((sum, session) => sum + Number(session.fee || 0), 0);

  response.json({
    overview: {
      total: total || 0,
      active: active || 0,
      available: 0,
      revenue,
      completion: completed || 0,
    },
  });
}

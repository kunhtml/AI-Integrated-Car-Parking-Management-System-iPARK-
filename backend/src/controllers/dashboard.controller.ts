import mongoose from "mongoose";
import { Request, Response } from "express";
import { ParkingSession } from "../models/ParkingSession.js";

const emptyOverview = {
  total: 0,
  active: 0,
  available: 0,
  revenue: 0,
  completion: 0,
  recent: [],
};

export async function getDashboardOverview(_request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ overview: emptyOverview });
    return;
  }

  const [total, active, completed, paidSessions, recent] = await Promise.all([
    ParkingSession.countDocuments({}),
    ParkingSession.countDocuments({ status: "active" }),
    ParkingSession.countDocuments({ status: "checked_out" }),
    ParkingSession.find({ status: "checked_out", paid: true }).select("fee").lean(),
    ParkingSession.find({}).sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  const revenue = paidSessions.reduce((sum, session) => sum + Number(session.fee || 0), 0);

  response.json({
    overview: {
      total: total || 0,
      active: active || 0,
      available: 0,
      revenue,
      completion: completed || 0,
      recent,
    },
  });
}

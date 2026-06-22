import mongoose from "mongoose";
import { Request, Response } from "express";
import { parkingConfig } from "../config/parking.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { serializeParkingSession } from "../utils/serializers.js";

const emptyOverview = {
  total: 0,
  active: 0,
  available: parkingConfig.totalCapacity,
  revenue: 0,
  completion: 0,
  recent: [] as ReturnType<typeof serializeParkingSession>[],
};

export async function getDashboardOverview(_request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ overview: emptyOverview });
    return;
  }

  const [total, active, completed, paidSessions, recent] = await Promise.all([
    ParkingSession.countDocuments({}),
    ParkingSession.countDocuments({ status: "Đang gửi" }),
    ParkingSession.countDocuments({ status: "Đã hoàn thành" }),
    ParkingSession.find({ status: "Đã hoàn thành", paymentStatus: "paid" }).select("fee").lean(),
    ParkingSession.find({}).sort({ createdAt: -1 }).limit(8),
  ]);

  const revenue = paidSessions.reduce((sum, session) => sum + Number(session.fee || 0), 0);

  response.json({
    overview: {
      total: total || 0,
      active: active || 0,
      available: Math.max(parkingConfig.totalCapacity - active, 0),
      revenue,
      completion: completed || 0,
      recent: recent.map(serializeParkingSession),
    },
  });
}

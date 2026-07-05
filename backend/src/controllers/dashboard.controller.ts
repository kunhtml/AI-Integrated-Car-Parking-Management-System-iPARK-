import mongoose from "mongoose";
import { Request, Response } from "express";
import { parkingConfig } from "../config/parking.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { PricingConfig } from "../models/PricingConfig.js";
import { Zone } from "../models/Zone.js";
import { serializeParkingSession } from "../utils/serializers.js";

const emptyOverview = {
  total: 0,
  active: 0,
  available: parkingConfig.totalCapacity,
  revenue: 0,
  completion: 0,
  hourlyPerformance: [
    ["06:00", 0],
    ["08:00", 0],
    ["10:00", 0],
    ["12:00", 0],
    ["14:00", 0],
    ["16:00", 0],
  ],
  recent: [] as ReturnType<typeof serializeParkingSession>[],
};

export async function getDashboardOverview(
  _request: Request,
  response: Response,
) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ overview: emptyOverview });
    return;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [total, active, completed, paidSessions, recent, todaySessions] = await Promise.all([
    ParkingSession.countDocuments({}),
    ParkingSession.countDocuments({ status: "Đang gửi" }),
    ParkingSession.countDocuments({ status: "Đã hoàn thành" }),
    ParkingSession.find({ status: "Đã hoàn thành", paymentStatus: "paid", updatedAt: { $gte: startOfDay } })
      .select("fee")
      .lean(),
    ParkingSession.find({}).sort({ createdAt: -1 }).limit(8),
    ParkingSession.find({ createdAt: { $gte: startOfDay } }).select("checkInAt createdAt").lean(),
  ]);

  const revenue = paidSessions.reduce(
    (sum, session) => sum + Number(session.fee || 0),
    0,
  );

  // Hourly counts calculation
  const hourBuckets: Record<string, number> = {
    "06:00": 0,
    "08:00": 0,
    "10:00": 0,
    "12:00": 0,
    "14:00": 0,
    "16:00": 0,
  };

  for (const session of todaySessions) {
    const date = session.checkInAt ? new Date(session.checkInAt) : new Date(session.createdAt);
    const hour = date.getHours();
    if (hour >= 5 && hour < 7) hourBuckets["06:00"]++;
    else if (hour >= 7 && hour < 9) hourBuckets["08:00"]++;
    else if (hour >= 9 && hour < 11) hourBuckets["10:00"]++;
    else if (hour >= 11 && hour < 13) hourBuckets["12:00"]++;
    else if (hour >= 13 && hour < 15) hourBuckets["14:00"]++;
    else if (hour >= 15 && hour < 17) hourBuckets["16:00"]++;
  }

  const maxCount = Math.max(...Object.values(hourBuckets), 1);
  const hourlyPerformance = Object.entries(hourBuckets).map(([label, count]) => [
    label,
    todaySessions.length === 0 ? 0 : Math.round((count / maxCount) * 100),
  ]);

  response.json({
    overview: {
      total: total || 0,
      active: active || 0,
      available: Math.max(parkingConfig.totalCapacity - active, 0),
      revenue,
      completion: completed || 0,
      hourlyPerformance,
      recent: recent.map(serializeParkingSession),
    },
  });
}

/** Public endpoint – không yêu cầu đăng nhập, dùng cho trang chủ */
export async function getPublicOverview(_request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({
      active: 0,
      available: parkingConfig.totalCapacity,
      zones: [],
      sessions: [],
    });
    return;
  }

  const [activeCount, activeSessions, zones] = await Promise.all([
    ParkingSession.countDocuments({ status: "Đang gửi" }),
    ParkingSession.find({ status: "Đang gửi" })
      .sort({ checkInAt: -1 })
      .limit(20)
      .select("plate ownerName vehicleType slot checkInAt status")
      .lean(),
    Zone.find({ isActive: true }).sort({ displayOrder: 1, name: 1 }).lean(),
  ]);

  const slotCountByZone: Record<string, number> = {};
  for (const s of activeSessions) {
    const zoneName = s.slot?.split("-")[0];
    if (zoneName)
      slotCountByZone[zoneName] = (slotCountByZone[zoneName] || 0) + 1;
  }

  const totalCapacity =
    zones.reduce((sum, z) => sum + (z.capacity || 0), 0) ||
    parkingConfig.totalCapacity;

  response.json({
    active: activeCount,
    available: Math.max(totalCapacity - activeCount, 0),
    totalCapacity,
    zones: zones.map((z) => ({
      name: z.name,
      capacity: z.capacity,
      occupied: slotCountByZone[z.name] || 0,
      available: Math.max(z.capacity - (slotCountByZone[z.name] || 0), 0),
    })),
    sessions: activeSessions.map((s) => ({
      plate: s.plate,
      owner: s.ownerName,
      slot: s.slot,
      checkIn: s.checkInAt
        ? new Date(s.checkInAt).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    })),
  });
}

export async function getPublicPricing(_request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({
      pricing: {
        hourlyRate: 5000,
        dailyMaxRate: 120000,
        monthlyRate: 1200000,
        overnightRate: 10000,
        freeMinutes: 20,
        overdueFineRate: 50000,
        graceExitMinutes: 10,
      },
    });
    return;
  }

  const config = await PricingConfig.findOne({ isActive: true })
    .sort({ updatedAt: -1 })
    .lean();
  response.json({
    pricing: {
      hourlyRate: config?.hourlyRate ?? 5000,
      dailyMaxRate: config?.dailyMaxRate ?? 120000,
      monthlyRate: config?.monthlyRate ?? 1200000,
      overnightRate: config?.overnightRate ?? 10000,
      freeMinutes: config?.freeMinutes ?? 20,
      overdueFineRate: config?.overdueFineRate ?? 50000,
      graceExitMinutes: config?.graceExitMinutes ?? 10,
    },
  });
}

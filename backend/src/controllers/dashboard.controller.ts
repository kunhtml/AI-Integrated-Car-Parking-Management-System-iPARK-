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

/** Public endpoint – không yêu cầu đăng nhập, dùng cho trang chủ */
export async function getPublicOverview(_request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ active: 0, available: parkingConfig.totalCapacity, zones: [], sessions: [] });
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

  // Tính toán số chỗ trống theo từng zone dựa trên số xe đang gửi trong zone đó
  const slotCountByZone: Record<string, number> = {};
  for (const s of activeSessions) {
    const zoneName = s.slot?.split("-")[0];
    if (zoneName) slotCountByZone[zoneName] = (slotCountByZone[zoneName] || 0) + 1;
  }

  const totalCapacity = zones.reduce((sum, z) => sum + (z.capacity || 0), 0) || parkingConfig.totalCapacity;

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
        hourlyRate: 10000,
        dailyMaxRate: 100000,
        monthlyRate: 1500000,
        overnightRate: 50000,
        freeMinutes: 20,
      },
    });
    return;
  }

  const config = await PricingConfig.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();
  response.json({
    pricing: {
      hourlyRate: config?.hourlyRate ?? 10000,
      dailyMaxRate: config?.dailyMaxRate ?? 100000,
      monthlyRate: config?.monthlyRate ?? 1500000,
      overnightRate: config?.overnightRate ?? 50000,
      freeMinutes: config?.freeMinutes ?? 20,
    },
  });
}

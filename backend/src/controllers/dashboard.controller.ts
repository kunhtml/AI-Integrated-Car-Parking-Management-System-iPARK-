import mongoose from "mongoose";
import { Request, Response } from "express";
import { parkingConfig } from "../config/parking.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";
import { PricingConfig } from "../models/PricingConfig.js";
import { User } from "../models/User.js";
import { Vehicle } from "../models/Vehicle.js";
import { Zone } from "../models/Zone.js";
import { ShiftSchedule } from "../models/ShiftSchedule.js";
import { serializeParkingSession } from "../utils/serializers.js";

type DashboardRange = "today" | "7d" | "30d";

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

function getVietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: value("year"), month: value("month"), day: value("day") };
}

function getDashboardRange(value: unknown) {
  const range: DashboardRange = value === "7d" || value === "30d" ? value : "today";
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  const { year, month, day } = getVietnamDateParts();
  const vietnamOffsetMs = 7 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(year, month - 1, day - (days - 1)) - vietnamOffsetMs);
  const end = new Date(Date.UTC(year, month - 1, day + 1) - vietnamOffsetMs - 1);

  return { range, start, end };
}

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
  request: Request,
  response: Response,
) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ overview: emptyOverview });
    return;
  }

  const { range, start, end } = getDashboardRange(request.query.range);
  const rangeFilter = { $gte: start, $lte: end };

  const [total, active, exits, paidTransactionSummary, freeSessionCount, customerCount, registeredVehicleCount, totalCapacity, recent, rangeSessions] = await Promise.all([
    ParkingSession.countDocuments({ checkInAt: rangeFilter, status: { $ne: "Đã hủy" } }),
    ParkingSession.countDocuments({ status: "Đang gửi" }),
    ParkingSession.countDocuments({ status: "Đã hoàn thành", checkOutAt: rangeFilter }),
    Transaction.aggregate<{ revenue: number; count: number }>([
      { $match: { status: "paid", paidAt: rangeFilter } },
      { $group: { _id: null, revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    ParkingSession.countDocuments({ status: "Đã hoàn thành", checkOutAt: rangeFilter, fee: 0 }),
    User.countDocuments({ role: "customer", createdAt: rangeFilter }),
    Vehicle.countDocuments({ status: "Đã đăng ký", createdAt: rangeFilter }),
    Zone.aggregate<{ total: number }>([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: "$capacity" } } },
    ]),
    ParkingSession.find({}).sort({ createdAt: -1 }).limit(8),
    ParkingSession.find({ checkInAt: rangeFilter, status: { $ne: "Đã hủy" } }).select("checkInAt").lean(),
  ]);

  const revenue = paidTransactionSummary[0]?.revenue ?? 0;
  const successfulTransactionCount = paidTransactionSummary[0]?.count ?? 0;

  const hourBuckets: Record<string, number> = {
    "06:00": 0,
    "08:00": 0,
    "10:00": 0,
    "12:00": 0,
    "14:00": 0,
    "16:00": 0,
  };

  for (const session of rangeSessions) {
    const hour = new Date(session.checkInAt).getHours();
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
    rangeSessions.length === 0 ? 0 : Math.round((count / maxCount) * 100),
  ]);
  const capacity = totalCapacity[0]?.total || parkingConfig.totalCapacity;

  response.json({
    overview: {
      range,
      from: start.toISOString(),
      to: end.toISOString(),
      total: total || 0,
      active: active || 0,
      available: Math.max(capacity - active, 0),
      capacity,
      revenue,
      entryCount: total || 0,
      exitCount: exits || 0,
      completion: exits || 0,
      successfulTransactionCount,
      freeSessionCount,
      customerCount,
      registeredVehicleCount,
      hourlyPerformance,
      recent: recent.map(serializeParkingSession),
    },
  });
}


type ShiftWindow = { start: Date; end: Date };

function getShiftDateTime(date: Date, time: string) {
  const { year, month, day } = getVietnamDateParts(date);
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 7 * 60 * 60 * 1000);
}

function getShiftWindow(schedule: { date: Date; startTime: string; endTime: string }): ShiftWindow | null {
  const start = getShiftDateTime(schedule.date, schedule.startTime);
  const end = getShiftDateTime(schedule.date, schedule.endTime);
  if (!start || !end) return null;
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function getStaffDashboardOverview(request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ overview: { sessions: [], entryCount: 0, exitCount: 0, activeCount: 0, revenue: 0 } });
    return;
  }

  const { start, end } = getDashboardRange("today");
  const scheduleSearchStart = new Date(start.getTime() - 48 * 60 * 60 * 1000);
  const schedules = await ShiftSchedule.find({
    staffId: request.user!.id,
    date: { $gte: scheduleSearchStart, $lte: end },
    status: { $in: ["checked_in", "completed"] },
  }).lean();
  const shiftWindows = schedules
    .map(getShiftWindow)
    .filter((window): window is ShiftWindow => Boolean(window && window.end >= start && window.start <= end));

  const ownedSessionCriteria: Array<Record<string, unknown>> = [
    { checkInStaff: request.user!.id },
    ...shiftWindows.map((window) => ({ checkInAt: { $gte: window.start, $lt: window.end } })),
  ];
  const sessions = await ParkingSession.find({
    status: { $ne: "Đã hủy" },
    checkInAt: { $gte: start, $lte: end },
    $or: ownedSessionCriteria,
  })
    .sort({ checkInAt: -1 })
    .limit(100);

  const completedSessions = sessions.filter((session) => session.status === "Đã hoàn thành");
  response.json({
    overview: {
      sessions: sessions.map(serializeParkingSession),
      entryCount: sessions.length,
      exitCount: completedSessions.length,
      activeCount: sessions.filter((session) => session.status === "Đang gửi").length,
      revenue: completedSessions.reduce((total, session) => total + (session.fee || 0), 0),
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

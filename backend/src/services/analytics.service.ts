import mongoose from "mongoose";
import { ParkingSession } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";

export type RevenuePoint = { date: string; revenue: number; count: number };
type RevenueGroupBy = "day" | "week" | "month" | "hour";

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
export type OccupancyPoint = {
  hour: number;
  avgOccupancy: number;
  maxOccupancy: number;
};
export type TopCustomerItem = {
  userId: string;
  name: string;
  email?: string;
  sessionCount: number;
  totalSpent: number;
};
export type PeakHourPoint = { dayOfWeek: number; hour: number; count: number };

/**
 * Revenue chart data grouped by hour/day/week/month.
 */
export async function getRevenueChart(
  from: Date,
  to: Date,
  groupBy: RevenueGroupBy = "day",
): Promise<RevenuePoint[]> {
  let dateFormat: string;
  switch (groupBy) {
    case "hour":
      dateFormat = "%H";
      break;
    case "week":
      dateFormat = "%Y-W%V";
      break;
    case "month":
      dateFormat = "%Y-%m";
      break;
    default:
      dateFormat = "%Y-%m-%d";
  }

  const results = await Transaction.aggregate([
    {
      $match: {
        status: "paid",
        paidAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat,
            date: "$paidAt",
            timezone: VIETNAM_TIME_ZONE,
          },
        },
        revenue: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return results.map((r) => ({
    date: r._id,
    revenue: r.revenue,
    count: r.count,
  }));
}

/**
 * Average number of vehicles occupying the car park by hour of day (0-23).
 * A session occupies a slot from check-in until check-out. The calculation
 * uses Vietnam local time so the chart hours match what staff see in the UI.
 */
export async function getOccupancyByHour(
  from: Date,
  to: Date,
): Promise<OccupancyPoint[]> {
  const sessions = await ParkingSession.find({
    checkInAt: { $lt: to },
    $or: [
      { checkOutAt: { $exists: false } },
      { checkOutAt: null },
      { checkOutAt: { $gt: from } },
    ],
  })
    .select({ checkInAt: 1, checkOutAt: 1 })
    .lean();

  const occupancyByHour = Array.from({ length: 24 }, () => 0);
  const samplesByHour = Array.from({ length: 24 }, () => 0);
  const dayCount = Math.max(
    1,
    Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)),
  );

  // Sample every local hour in the selected range. This handles sessions that
  // span midnight and sessions that were already active before `from`.
  for (let day = 0; day < dayCount; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const sample = new Date(
        from.getTime() + (day * 24 + hour) * 60 * 60 * 1000,
      );
      if (sample > to) continue;
      const activeCount = sessions.reduce((count, session) => {
        const checkIn = new Date(session.checkInAt).getTime();
        const checkOut = session.checkOutAt
          ? new Date(session.checkOutAt).getTime()
          : to.getTime();
        return checkIn <= sample.getTime() && sample.getTime() < checkOut
          ? count + 1
          : count;
      }, 0);
      occupancyByHour[hour] += activeCount;
      samplesByHour[hour] += 1;
    }
  }

  return occupancyByHour.map((total, hour) => ({
    hour,
    avgOccupancy: samplesByHour[hour]
      ? Math.round(total / samplesByHour[hour])
      : 0,
    maxOccupancy: total,
  }));
}

/**
 * Top customers by session count and total spending.
 */
export async function getTopCustomers(
  limit: number = 20,
  from?: Date,
  to?: Date,
): Promise<any[]> {
  const match: Record<string, unknown> = {
    plate: { $exists: true, $ne: "" },
  };
  if (from && to) {
    match.checkInAt = { $gte: from, $lte: to };
  }

  // Group theo biển số xe (plate) để gom cả khách vãng lai và thành viên
  const results = await ParkingSession.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$plate",
        sessionCount: { $sum: 1 },
        totalSpent: { $sum: "$fee" },
        ownerName: { $last: "$ownerName" },
        customerType: { $last: "$customerType" },
        isRegisteredMember: { $last: "$isRegisteredMember" },
        ownerUserId: { $last: "$ownerUserId" },
      },
    },
    { $sort: { sessionCount: -1 } },
    { $limit: limit },
  ]);

  // Map lại kết quả trả về biển số xe rõ ràng
  return results.map((r) => {
    const isMember = r.customerType === "member" || r.isRegisteredMember;
    return {
      userId: r._id, // dùng plate làm id duy nhất
      plate: r._id,
      name: r.ownerName && r.ownerName !== "Guest" ? r.ownerName : (isMember ? "Thành viên" : "Khách vãng lai"),
      customerType: isMember ? "member" : "guest",
      sessionCount: r.sessionCount,
      totalSpent: r.totalSpent || 0,
    };
  });
}

/**
 * Peak hours analysis — count of check-ins by day of week and hour.
 */
export async function getPeakHoursAnalysis(
  from: Date,
  to: Date,
): Promise<PeakHourPoint[]> {
  const results = await ParkingSession.aggregate([
    {
      $match: {
        checkInAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: {
          dayOfWeek: { $dayOfWeek: "$checkInAt" }, // 1=Sunday, 7=Saturday
          hour: { $hour: "$checkInAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.dayOfWeek": 1, "_id.hour": 1 } },
  ]);

  return results.map((r) => ({
    dayOfWeek: r._id.dayOfWeek,
    hour: r._id.hour,
    count: r.count,
  }));
}

/**
 * RP-06: Entry count by zone within date range.
 */
export async function getEntryByZone(from: Date, to: Date) {
  const results = await ParkingSession.aggregate([
    { $match: { checkInAt: { $gte: from, $lte: to } } },
    { $group: { _id: "$zone", entryCount: { $sum: 1 } } },
    { $sort: { entryCount: -1 } },
  ]);

  return results.map((r) => ({
    zone: r._id || "Không xác định",
    entryCount: r.entryCount,
  }));
}

/**
 * RP-07: Exit count by zone within date range.
 */
export async function getExitByZone(from: Date, to: Date) {
  const results = await ParkingSession.aggregate([
    {
      $match: { status: "Đã hoàn thành", checkOutAt: { $gte: from, $lte: to } },
    },
    {
      $group: {
        _id: "$zone",
        exitCount: { $sum: 1 },
        revenue: { $sum: "$fee" },
      },
    },
    { $sort: { exitCount: -1 } },
  ]);

  return results.map((r) => ({
    zone: r._id || "Không xác định",
    exitCount: r.exitCount,
    revenue: r.revenue,
  }));
}

/**
 * RP-08: Penalty/overdue report — sessions that were flagged overdue.
 */
export async function getPenaltyReport(from: Date, to: Date) {
  const results = await ParkingSession.aggregate([
    {
      $match: {
        isOverstayed: true,
        checkInAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: null,
        totalOverdue: { $sum: 1 },
        totalOverdueMinutes: { $sum: "$overdueMinutes" },
        avgOverdueMinutes: { $avg: "$overdueMinutes" },
      },
    },
  ]);

  const sessions = await ParkingSession.find({
    isOverstayed: true,
    checkInAt: { $gte: from, $lte: to },
  })
    .sort({ overdueMinutes: -1 })
    .limit(20)
    .select("plate ownerName slot zone overdueMinutes fee checkInAt");

  const summary = results[0] || {
    totalOverdue: 0,
    totalOverdueMinutes: 0,
    avgOverdueMinutes: 0,
  };

  return {
    summary: {
      totalOverdue: summary.totalOverdue,
      totalOverdueMinutes: summary.totalOverdueMinutes,
      avgOverdueMinutes: Math.round(summary.avgOverdueMinutes || 0),
    },
    topOverdue: sessions.map((s) => ({
      id: s._id.toString(),
      plate: s.plate,
      ownerName: s.ownerName,
      slot: s.slot,
      zone: (s as any).zone || "—",
      overdueMinutes: (s as any).overdueMinutes || 0,
      fee: s.fee,
    })),
  };
}

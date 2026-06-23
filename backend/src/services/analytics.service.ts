import mongoose from "mongoose";
import { ParkingSession } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";

export type RevenuePoint = { date: string; revenue: number; count: number };
export type OccupancyPoint = { hour: number; avgOccupancy: number; maxOccupancy: number };
export type TopCustomerItem = { userId: string; name: string; email?: string; sessionCount: number; totalSpent: number };
export type PeakHourPoint = { dayOfWeek: number; hour: number; count: number };

/**
 * Revenue chart data grouped by day/week/month.
 */
export async function getRevenueChart(
  from: Date,
  to: Date,
  groupBy: "day" | "week" | "month" = "day",
): Promise<RevenuePoint[]> {
  let dateFormat: string;
  switch (groupBy) {
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
        _id: { $dateToString: { format: dateFormat, date: "$paidAt" } },
        revenue: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return results.map((r) => ({ date: r._id, revenue: r.revenue, count: r.count }));
}

/**
 * Average occupancy by hour of day (0-23).
 */
export async function getOccupancyByHour(from: Date, to: Date): Promise<OccupancyPoint[]> {
  const results = await ParkingSession.aggregate([
    {
      $match: {
        checkInAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: { $hour: "$checkInAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Calculate total days in range for averaging
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));

  // Fill all 24 hours
  const hourMap = new Map<number, number>();
  for (const r of results) {
    hourMap.set(r._id, r.count);
  }

  return Array.from({ length: 24 }, (_, hour) => {
    const total = hourMap.get(hour) || 0;
    return {
      hour,
      avgOccupancy: Math.round(total / days),
      maxOccupancy: total,
    };
  });
}

/**
 * Top customers by session count and total spending.
 */
export async function getTopCustomers(
  limit: number = 10,
  from?: Date,
  to?: Date,
): Promise<TopCustomerItem[]> {
  const match: Record<string, unknown> = {
    ownerUserId: { $exists: true, $ne: null },
  };
  if (from && to) {
    match.checkInAt = { $gte: from, $lte: to };
  }

  const results = await ParkingSession.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$ownerUserId",
        sessionCount: { $sum: 1 },
        totalSpent: { $sum: "$fee" },
      },
    },
    { $sort: { sessionCount: -1 } },
    { $limit: limit },
  ]);

  // Populate user info
  const userIds = results.map((r) => r._id);
  const users = await User.find({ _id: { $in: userIds } });
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return results.map((r) => {
    const user = userMap.get(r._id.toString());
    return {
      userId: r._id.toString(),
      name: user?.name || "Không xác định",
      email: user?.email,
      sessionCount: r.sessionCount,
      totalSpent: r.totalSpent,
    };
  });
}

/**
 * Peak hours analysis — count of check-ins by day of week and hour.
 */
export async function getPeakHoursAnalysis(from: Date, to: Date): Promise<PeakHourPoint[]> {
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
    { $match: { status: "Đã hoàn thành", checkOutAt: { $gte: from, $lte: to } } },
    { $group: { _id: "$zone", exitCount: { $sum: 1 }, revenue: { $sum: "$fee" } } },
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

  const summary = results[0] || { totalOverdue: 0, totalOverdueMinutes: 0, avgOverdueMinutes: 0 };

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

/**
 * RP-09: Wallet activity report — top-ups and auto-deductions.
 */
export async function getWalletReport(from: Date, to: Date) {
  // Top-up transactions
  const topUps = await Transaction.aggregate([
    {
      $match: {
        content: { $regex: /^TOPUP/ },
        status: "paid",
        paidAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: null,
        totalTopUps: { $sum: 1 },
        totalTopUpAmount: { $sum: "$amount" },
      },
    },
  ]);

  // Wallet-paid sessions (paymentMethod = "wallet")
  const walletPayments = await ParkingSession.aggregate([
    {
      $match: {
        paymentMethod: "wallet",
        checkOutAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: null,
        totalWalletPayments: { $sum: 1 },
        totalWalletAmount: { $sum: "$fee" },
      },
    },
  ]);

  const topUpData = topUps[0] || { totalTopUps: 0, totalTopUpAmount: 0 };
  const paymentData = walletPayments[0] || { totalWalletPayments: 0, totalWalletAmount: 0 };

  return {
    topUps: {
      count: topUpData.totalTopUps,
      amount: topUpData.totalTopUpAmount,
    },
    walletPayments: {
      count: paymentData.totalWalletPayments,
      amount: paymentData.totalWalletAmount,
    },
    netFlow: topUpData.totalTopUpAmount - paymentData.totalWalletAmount,
  };
}

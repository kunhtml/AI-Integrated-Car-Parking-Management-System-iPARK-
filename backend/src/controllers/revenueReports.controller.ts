import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { ParkingSession } from "../models/ParkingSession.js";
import { ReportExport } from "../models/ReportExport.js";
import { serializeReportExport } from "../utils/serializers.js";

const emptyReport = {
  filters: {
    dateRange: "this-week",
    parkingArea: "all",
    vehicleType: "car",
  },
  kpis: {
    totalRevenue: 0,
    vehicleCount: 0,
    occupancyRate: 0,
    avgParkingTimeMinutes: 0,
    activeSessions: 0,
  },
  revenueChart: [],
  trafficChart: [],
  capacity: {
    occupiedSlots: 0,
    totalSlots: 30,
    threshold: 85,
  },
  exportHistory: [],
};

function getRange(dateRange: string) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  if (dateRange === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (dateRange === "this-month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getRevenueReport(request: Request, response: Response) {
  const dateRange = typeof request.query.dateRange === "string" ? request.query.dateRange : "this-week";
  const parkingArea = typeof request.query.parkingArea === "string" ? request.query.parkingArea : "all";
  const vehicleType = typeof request.query.vehicleType === "string" ? request.query.vehicleType : "car";

  if (mongoose.connection.readyState !== 1) {
    response.json({ report: { ...emptyReport, filters: { dateRange, parkingArea, vehicleType } } });
    return;
  }

  const { start, end } = getRange(dateRange);
  const criteria: Record<string, unknown> = { checkInAt: { $gte: start, $lte: end } };
  if (parkingArea !== "all") criteria.zone = parkingArea.replace("zone-", "").toUpperCase();

  const sessions = await ParkingSession.find(criteria).lean();
  const exports = await ReportExport.find({ reportType: "revenue" }).sort({ createdAt: -1 }).limit(10);

  const totalRevenue = sessions.reduce(
    (sum, session) => sum + (session.paymentStatus === "paid" ? Number(session.fee || 0) : 0),
    0,
  );
  const vehicleCount = sessions.length;
  const activeSessions = sessions.filter((session) => session.status === "Đang gửi").length;
  const completed = sessions.filter((session) => session.checkOutAt);
  const avgParkingTimeMinutes = completed.length
    ? Math.round(
        completed.reduce((sum, session) => {
          const inAt = new Date(session.checkInAt).getTime();
          const outAt = new Date(session.checkOutAt as Date).getTime();
          return sum + Math.max(0, outAt - inAt) / 60000;
        }, 0) / completed.length,
      )
    : 0;

  const buckets = new Map<string, { label: string; revenue: number; entries: number; exits: number }>();
  for (const session of sessions) {
    const key = dayKey(new Date(session.checkInAt));
    const bucket = buckets.get(key) || { label: key, revenue: 0, entries: 0, exits: 0 };
    bucket.entries += 1;
    bucket.revenue += session.paymentStatus === "paid" ? Number(session.fee || 0) : 0;
    if (session.checkOutAt) bucket.exits += 1;
    buckets.set(key, bucket);
  }

  const occupiedSlots = activeSessions;
  const totalSlots = 30;

  response.json({
    report: {
      filters: { dateRange, parkingArea, vehicleType },
      kpis: {
        totalRevenue,
        vehicleCount,
        occupancyRate: totalSlots ? Math.round((occupiedSlots / totalSlots) * 100) : 0,
        avgParkingTimeMinutes,
        activeSessions,
      },
      revenueChart: Array.from(buckets.values()).map((item) => ({ label: item.label, revenue: item.revenue })),
      trafficChart: Array.from(buckets.values()).map((item) => ({
        label: item.label,
        entries: item.entries,
        exits: item.exits,
      })),
      capacity: {
        occupiedSlots,
        totalSlots,
        threshold: 85,
      },
      exportHistory: exports.map(serializeReportExport),
    },
  });
}

export async function createRevenueReportExport(request: Request, response: Response) {
  const body = z
    .object({
      format: z.enum(["PDF", "Excel"]),
      period: z.string().min(1),
    })
    .parse(request.body);

  const extension = body.format === "PDF" ? "pdf" : "xlsx";
  const fileName = `revenue-${body.period.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.${extension}`;

  if (mongoose.connection.readyState !== 1) {
    response.status(201).json({
      export: {
        id: `temp-${Date.now()}`,
        fileName,
        reportType: "revenue",
        format: body.format,
        period: body.period,
        createdBy: request.user?.email || "System",
        status: "Ready",
        createdAt: new Date().toISOString(),
      },
      message: "Chưa kết nối DB, export history được trả về ở chế độ tạm.",
    });
    return;
  }

  const item = await ReportExport.create({
    fileName,
    reportType: "revenue",
    format: body.format,
    period: body.period,
    createdBy: request.user?.id && mongoose.Types.ObjectId.isValid(request.user.id) ? request.user.id : undefined,
    status: "Ready",
  });

  response.status(201).json({ export: serializeReportExport(item), message: "Report export history recorded." });
}

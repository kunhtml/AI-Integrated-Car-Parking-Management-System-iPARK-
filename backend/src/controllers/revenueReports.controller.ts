import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ParkingSession, ParkingSessionDocument } from "../models/ParkingSession.js";
import { ReportExport } from "../models/ReportExport.js";
import { Transaction } from "../models/Transaction.js";
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

function formatDateInput(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function getDateRange(request: Request) {
  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);
  const fromText = formatDateInput(request.query.from) || defaultDate;
  const toText = formatDateInput(request.query.to) || fromText;
  const from = new Date(`${fromText}T00:00:00.000`);
  const to = new Date(`${toText}T23:59:59.999`);

  return { fromText, toText, from, to };
}

function sessionRow(session: ParkingSessionDocument) {
  return {
    "Mã phiên": session._id.toString(),
    "Biển số": session.plate,
    "Chủ xe": session.ownerName,
    "Loại xe": session.vehicleType,
    "Vị trí": session.slot,
    "Trạng thái": session.status,
    "Giờ vào": session.checkInAt.toLocaleString("vi-VN"),
    "Giờ ra": session.checkOutAt?.toLocaleString("vi-VN") || "",
    "Tổng phút": session.feeBreakdown?.totalMinutes ?? "",
    "Giờ tính phí": session.feeBreakdown?.billableHours ?? "",
    "Đơn giá giờ": session.feeBreakdown?.hourlyRate ?? "",
    "Phí gửi": session.feeBreakdown?.parkingFee ?? session.fee,
    "Phí phạt": session.feeBreakdown?.overdueFine ?? 0,
    "Tổng tiền": session.fee,
    "Match": session.matchStatus || "",
    "AI biển vào": session.entryDetectedPlate || "",
    "AI biển ra": session.exitDetectedPlate || "",
  };
}

export async function getReportSummary(request: Request, response: Response) {
  const { fromText, toText, from, to } = getDateRange(request);
  const [entryCount, exitSessions, activeCount] = await Promise.all([
    ParkingSession.countDocuments({ checkInAt: { $gte: from, $lte: to } }),
    ParkingSession.find({
      status: "Đã hoàn thành",
      checkOutAt: { $gte: from, $lte: to },
    }),
    ParkingSession.countDocuments({ status: "Đang gửi" }),
  ]);

  const revenue = exitSessions.reduce((sum, session) => sum + session.fee, 0);
  const freeSessionCount = exitSessions.filter((session) => session.fee === 0).length;
  const paidSessionCount = exitSessions.filter((session) => session.fee > 0).length;

  response.json({
    summary: {
      from: fromText,
      to: toText,
      entryCount,
      exitCount: exitSessions.length,
      activeCount,
      revenue,
      freeSessionCount,
      paidSessionCount,
    },
  });
}

export async function exportReport(request: Request, response: Response) {
  const { fromText, toText, from, to } = getDateRange(request);
  const type = request.query.type === "revenue" ? "revenue" : "sessions";
  const format = request.query.format === "pdf" ? "pdf" : "xlsx";
  const sessions =
    type === "revenue"
      ? await ParkingSession.find({
          status: "Đã hoàn thành",
          checkOutAt: { $gte: from, $lte: to },
        }).sort({ checkOutAt: -1 })
      : await ParkingSession.find({ checkInAt: { $gte: from, $lte: to } }).sort({ checkInAt: -1 });
  const rows = sessions.map(sessionRow);

  if (format === "pdf") {
    const transactions = await Transaction.find({
      createdAt: { $gte: from, $lte: to },
      status: "paid",
    });
    const totalPaid = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const buffer = await buildPdfReport({
      title: type === "revenue" ? "Bao cao doanh thu iPARK" : "Bao cao phien do xe iPARK",
      fromText,
      toText,
      sessions,
      totalPaid,
    });

    response.setHeader(
      "Content-Disposition",
      `attachment; filename="ipark-${type}-${fromText}-${toText}.pdf"`,
    );
    response.setHeader("Content-Type", "application/pdf");
    response.end(buffer);
    return;
  }

  const normalizedRows = rows.length ? rows : [{ "Không có dữ liệu": "" }];
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(type === "revenue" ? "Doanh thu" : "Phiên đỗ xe");
  worksheet.columns = Object.keys(normalizedRows[0]).map((key) => ({
    header: key,
    key,
    width: Math.max(16, key.length + 4),
  }));
  worksheet.addRows(normalizedRows);
  worksheet.getRow(1).font = { bold: true };
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  response.setHeader(
    "Content-Disposition",
    `attachment; filename="ipark-${type}-${fromText}-${toText}.xlsx"`,
  );
  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  response.end(buffer);
}

function buildPdfReport(values: {
  title: string;
  fromText: string;
  toText: string;
  sessions: ParkingSessionDocument[];
  totalPaid: number;
}) {
  return new Promise<Buffer>((resolve) => {
    const document = new PDFDocument({ margin: 42, size: "A4" });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));

    const revenue = values.sessions.reduce((sum, session) => sum + session.fee, 0);
    document.fontSize(20).text(values.title, { align: "center" });
    document.moveDown(0.5);
    document.fontSize(11).text(`Khoang ngay: ${values.fromText} - ${values.toText}`);
    document.text(`Tong phien: ${values.sessions.length}`);
    document.text(`Doanh thu checkout: ${revenue.toLocaleString("vi-VN")} VND`);
    document.text(`Da xac nhan thanh toan: ${values.totalPaid.toLocaleString("vi-VN")} VND`);
    document.moveDown();

    document.fontSize(12).text("Danh sach phien gan nhat", { underline: true });
    document.moveDown(0.5);
    values.sessions.slice(0, 40).forEach((session, index) => {
      document
        .fontSize(9)
        .text(
          `${index + 1}. ${session.plate} | ${session.ownerName} | ${session.status} | ${session.fee.toLocaleString(
            "vi-VN",
          )} VND`,
        );
    });

    if (!values.sessions.length) {
      document.fontSize(10).text("Khong co du lieu trong khoang ngay da chon.");
    }

    document.end();
  });
}

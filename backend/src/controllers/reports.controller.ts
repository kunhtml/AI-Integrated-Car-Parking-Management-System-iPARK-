import { Request, Response } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ParkingSession, ParkingSessionDocument } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";
import { registerVietnameseFonts } from "../utils/pdfFonts.js";

function formatDateInput(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

function vietnamDateText(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function vietnamDayBoundary(dateText: string, endOfDay: boolean) {
  const [year, month, day] = dateText.split("-").map(Number);
  const vietnamOffsetMs = 7 * 60 * 60 * 1000;
  const timeOfDayMs = endOfDay ? 24 * 60 * 60 * 1000 - 1 : 0;

  return new Date(Date.UTC(year, month - 1, day) - vietnamOffsetMs + timeOfDayMs);
}

function getDateRange(request: Request) {
  const defaultDate = vietnamDateText();
  const fromText = formatDateInput(request.query.from) || defaultDate;
  const toText = formatDateInput(request.query.to) || fromText;
  const from = vietnamDayBoundary(fromText, false);
  const to = vietnamDayBoundary(toText, true);

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
      title: type === "revenue" ? "Báo cáo doanh thu iPARK" : "Báo cáo phiên đỗ xe iPARK",
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

    const fonts = registerVietnameseFonts(document);
    const revenue = values.sessions.reduce((sum, session) => sum + session.fee, 0);
    document.font(fonts.bold).fontSize(20).text(values.title, { align: "center" });
    document.moveDown(0.5);
    document.font(fonts.regular).fontSize(11).text(`Khoảng ngày: ${values.fromText} - ${values.toText}`);
    document.text(`Tổng phiên: ${values.sessions.length}`);
    document.text(`Doanh thu checkout: ${revenue.toLocaleString("vi-VN")} VND`);
    document.text(`Đã xác nhận thanh toán: ${values.totalPaid.toLocaleString("vi-VN")} VND`);
    document.moveDown();

    document.font(fonts.bold).fontSize(12).text("Danh sách phiên gần nhất", { underline: true });
    document.moveDown(0.5);
    document.font(fonts.regular);
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
      document.fontSize(10).text("Không có dữ liệu trong khoảng ngày đã chọn.");
    }

    document.end();
  });
}

// --- Advanced Analytics Endpoints ---
import {
  getOccupancyByHour,
  getPeakHoursAnalysis,
  getRevenueChart,
  getTopCustomers,
} from "../services/analytics.service.js";

export async function revenueChartHandler(request: Request, response: Response) {
  const { from, to } = getDateRange(request);
  const groupBy = (request.query.groupBy as "day" | "week" | "month" | "hour") || "day";
  const data = await getRevenueChart(from, to, groupBy);
  response.json({ data });
}

export async function occupancyHourlyHandler(request: Request, response: Response) {
  const { from, to } = getDateRange(request);
  const data = await getOccupancyByHour(from, to);
  response.json({ data });
}

export async function topCustomersHandler(request: Request, response: Response) {
  const { from, to } = getDateRange(request);
  const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 10));
  const data = await getTopCustomers(limit, from, to);
  response.json({ data });
}

export async function peakHoursHandler(request: Request, response: Response) {
  const { from, to } = getDateRange(request);
  const data = await getPeakHoursAnalysis(from, to);
  response.json({ data });
}

// --- RP-06/07/08/09 ---
import {
  getEntryByZone,
  getExitByZone,
  getPenaltyReport,
} from "../services/analytics.service.js";

export async function entryByZoneHandler(request: Request, response: Response) {
  const { from, to } = getDateRange(request);
  const data = await getEntryByZone(from, to);
  response.json({ data });
}

export async function exitByZoneHandler(request: Request, response: Response) {
  const { from, to } = getDateRange(request);
  const data = await getExitByZone(from, to);
  response.json({ data });
}

export async function penaltyReportHandler(request: Request, response: Response) {
  const { from, to } = getDateRange(request);
  const data = await getPenaltyReport(from, to);
  response.json({ data });
}

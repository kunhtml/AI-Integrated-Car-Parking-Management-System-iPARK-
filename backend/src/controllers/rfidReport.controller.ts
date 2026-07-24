import { Request, Response } from "express";
import { RfidCard } from "../models/RfidCard.js";
import { RfidScanLog } from "../models/RfidScanLog.js";

/**
 * GET /api/rfid-reports/status
 * Aggregate RFID card counts by status and include recent scan count (last 24h).
 */
export async function getRfidStatusReport(
  _request: Request,
  response: Response,
) {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [statusCounts, totalCards, recentScanCount] = await Promise.all([
    RfidCard.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    RfidCard.countDocuments(),
    RfidScanLog.countDocuments({ createdAt: { $gte: twentyFourHoursAgo } }),
  ]);

  const cardsByStatus: Record<string, number> = {
    available: 0,
    "in-use": 0,
    lost: 0,
    blocked: 0,
  };
  for (const item of statusCounts) {
    if (item._id in cardsByStatus) {
      cardsByStatus[item._id] = item.count;
    }
  }

  response.json({
    totalCards,
    cardsByStatus,
    recentScanCount,
    recentScanWindow: "24h",
    generatedAt: now.toISOString(),
  });
}

/**
 * GET /api/rfid-reports/usage
 * Aggregate scan logs by action type over a date range (from, to query params).
 * Returns a daily breakdown.
 */
export async function getRfidUsageReport(request: Request, response: Response) {
  const { from, to } = request.query;

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const dateFrom = from ? new Date(String(from)) : defaultFrom;
  const dateTo = to ? new Date(String(to)) : now;

  // Validate dates
  if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
    response.status(400).json({ message: "Tham số ngày không hợp lệ." });
    return;
  }

  const dailyBreakdown = await RfidScanLog.aggregate([
    {
      $match: {
        createdAt: { $gte: dateFrom, $lte: dateTo },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          action: "$action",
        },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.date",
        actions: {
          $push: {
            action: "$_id.action",
            count: "$count",
          },
        },
        totalCount: { $sum: "$count" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const days = dailyBreakdown.map((day) => ({
    date: day._id,
    actions: day.actions,
    totalCount: day.totalCount,
  }));

  // Summary totals by action
  const actionSummary: Record<string, number> = {};
  for (const day of days) {
    for (const action of day.actions) {
      actionSummary[action.action] =
        (actionSummary[action.action] || 0) + action.count;
    }
  }

  response.json({
    dateRange: {
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
    },
    actionSummary,
    dailyBreakdown: days,
    totalScans: days.reduce((sum, d) => sum + d.totalCount, 0),
  });
}

/**
 * GET /api/rfid-reports/export
 * Export RFID data as JSON (all cards + recent scan logs).
 */
export async function exportRfidReport(
  _request: Request,
  response: Response,
) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [cards, recentScans] = await Promise.all([
    RfidCard.find()
      .sort({ createdAt: -1 })
      .lean(),
    RfidScanLog.find({ createdAt: { $gte: thirtyDaysAgo } })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    cards,
    recentScans,
    summary: {
      totalCards: cards.length,
      totalRecentScans: recentScans.length,
      scanWindowDays: 30,
    },
  };

  response.setHeader("Content-Type", "application/json");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="rfid-report-${new Date().toISOString().slice(0, 10)}.json"`,
  );
  response.json(exportData);
}

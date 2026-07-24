import { Request, Response } from "express";
import {
  Notification,
} from "../models/Notification.js";
import {
  Incident,
} from "../models/Incident.js";
import {
  Shift,
} from "../models/Shift.js";
import {
  Feedback,
} from "../models/Feedback.js";

/* ───────────────── Notifications ───────────────── */

export async function listNotifications(request: Request, response: Response) {
  const user = request.user as { role?: string; id?: string } | undefined;
  const roleFilter = user?.role || "all";

  const notifications = await Notification.find({
    targetRole: { $in: [roleFilter, "all"] },
  } as any)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  response.json({ notifications });
}

export async function markNotificationRead(
  request: Request,
  response: Response,
) {
  const notification = await Notification.findByIdAndUpdate(
    request.params.id,
    { read: true, readAt: new Date() },
    { new: true },
  );

  if (!notification) {
    response.status(404).json({ message: "Không tìm thấy thông báo" });
    return;
  }

  response.json({ ok: true, notification });
}

export async function markAllNotificationsRead(
  request: Request,
  response: Response,
) {
  const user = request.user as { role?: string } | undefined;
  const roleFilter = user?.role || "all";
  await Notification.updateMany(
    { read: false, targetRole: { $in: [roleFilter, "all"] } } as any,
    { read: true, readAt: new Date() },
  );
  response.json({ ok: true });
}

/* ───────────────── Feedback ───────────────── */

export async function listFeedback(_request: Request, response: Response) {
  const feedback = await Feedback.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  response.json({ feedback });
}

export async function createFeedbackPublic(
  request: Request,
  response: Response,
) {
  const { name, phone, email, message } = request.body;
  if (!name || !phone || !email || !message) {
    response
      .status(400)
      .json({ message: "Vui lòng nhập đầy đủ thông tin." });
    return;
  }

  const feedback = await Feedback.create({
    subject: `[Liên hệ] ${name} - ${phone}`,
    content: `Họ tên: ${name}\nSố điện thoại: ${phone}\nEmail: ${email}\nNhu cầu: ${message}`,
    name,
    phone,
    email,
    status: "Moi",
  });

  response.status(201).json({ success: true, feedback });
}

export async function createFeedback(request: Request, response: Response) {
  const user = request.user as { id?: string } | undefined;
  const feedback = await Feedback.create({
    ...request.body,
    userId: user?.id,
    status: "Moi",
  });
  response.status(201).json({ feedback });
}

export async function updateFeedbackStatus(
  request: Request,
  response: Response,
) {
  const user = request.user as { id?: string } | undefined;
  const feedback = await Feedback.findByIdAndUpdate(
    request.params.id,
    {
      status: "Da xu ly",
      respondedBy: user?.id,
      respondedAt: new Date(),
    },
    { new: true },
  );

  if (!feedback) {
    response.status(404).json({ message: "Không tìm thấy phản hồi" });
    return;
  }

  response.json({ ok: true, feedback });
}

/* ───────────────── Shifts ───────────────── */

export async function listShifts(request: Request, response: Response) {
  const { status, limit } = request.query;
  const filter: Record<string, unknown> = {};

  if (status) {
    filter.status = status;
  }

  const shifts = await Shift.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit) || 100)
    .populate("startedBy", "name")
    .populate("endedBy", "name")
    .lean();

  response.json({ shifts });
}

export async function startShift(request: Request, response: Response) {
  const user = request.user as { id?: string; name?: string } | undefined;
  const { name, note } = request.body;

  const shift = await Shift.create({
    name: name || `Ca ${new Date().toLocaleDateString("vi-VN")}`,
    startedBy: user?.id,
    startAt: new Date(),
    status: "Dang mo",
    note,
  });

  response.status(201).json({ shift });
}

export async function endShift(request: Request, response: Response) {
  const user = request.user as { id?: string } | undefined;

  const shift = await Shift.findByIdAndUpdate(
    request.params.id,
    {
      status: "Da dong",
      endAt: new Date(),
      endedBy: user?.id,
    },
    { new: true },
  );

  if (!shift) {
    response.status(404).json({ message: "Không tìm thấy ca làm việc" });
    return;
  }

  response.json({ ok: true, shift });
}

/* ───────────────── Incidents ───────────────── */

export async function listIncidents(request: Request, response: Response) {
  const { status, type, limit } = request.query;
  const filter: Record<string, unknown> = {};

  if (status) {
    filter.status = status;
  }
  if (type) {
    filter.type = type;
  }

  const incidents = await Incident.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit) || 200)
    .populate("reportedBy", "name")
    .populate("resolvedBy", "name")
    .lean();

  response.json({ incidents });
}

export async function createIncident(request: Request, response: Response) {
  const user = request.user as { id?: string } | undefined;
  const incident = await Incident.create({
    ...request.body,
    reportedBy: user?.id,
    status: "Moi",
  });

  // Notify admins
  try {
    const { createNotification } = await import(
      "../services/notification.service.js"
    );
    await createNotification({
      title: `Sự cố mới: ${incident.type}`,
      content: incident.plate
        ? `Biển số: ${incident.plate} - ${incident.note}`
        : incident.note,
      type: "incident",
      targetRole: "admin",
    });
  } catch {
    // notification service not available
  }

  response.status(201).json({ incident });
}

export async function resolveIncident(request: Request, response: Response) {
  const user = request.user as { id?: string } | undefined;
  const { resolution } = request.body;

  const incident = await Incident.findByIdAndUpdate(
    request.params.id,
    {
      status: "Da xu ly",
      resolvedBy: user?.id,
      resolvedAt: new Date(),
      resolution,
    },
    { new: true },
  );

  if (!incident) {
    response.status(404).json({ message: "Không tìm thấy sự cố" });
    return;
  }

  response.json({ ok: true, incident });
}

/* ───────────────── Report Summary ───────────────── */

export async function getReportSummary(request: Request, response: Response) {
  const { from, to } = request.query;

  try {
    const { ParkingSession } = await import("../models/ParkingSession.js");
    const { Transaction } = await import("../models/Transaction.js");

    const dateFilter: Record<string, unknown> = {};
    if (from) {
      dateFilter.$gte = new Date(from as string);
    }
    if (to) {
      dateFilter.$lte = new Date(to as string);
    }

    const sessionFilter: Record<string, unknown> = {};
    const txFilter: Record<string, unknown> = {};

    if (Object.keys(dateFilter).length > 0) {
      sessionFilter.checkInAt = dateFilter;
      txFilter.createdAt = dateFilter;
    }

    const totalSessions = await ParkingSession.countDocuments(sessionFilter);
    const completedSessions = await ParkingSession.countDocuments({
      ...sessionFilter,
      status: "Da hoan thanh",
    } as any);
    const revenueResult = await Transaction.aggregate([
      { $match: { ...txFilter, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ] as any[]);

    const totalRevenue = revenueResult[0]?.total || 0;

    response.json({
      summary: {
        from: from || "",
        to: to || "",
        totalSessions,
        totalRevenue,
        completedSessions,
      },
    });
  } catch {
    response.json({
      summary: {
        from: from || "",
        to: to || "",
        totalSessions: 0,
        totalRevenue: 0,
        completedSessions: 0,
      },
    });
  }
}

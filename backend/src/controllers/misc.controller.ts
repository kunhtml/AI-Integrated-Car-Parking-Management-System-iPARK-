import { Request, Response } from "express";

const notifications: Array<Record<string, unknown>> = [];
const feedback: Array<Record<string, unknown>> = [];
const shifts: Array<Record<string, unknown>> = [];
const incidents: Array<Record<string, unknown>> = [];

export async function listNotifications(_request: Request, response: Response) {
  response.json({ notifications });
}

export async function markNotificationRead(request: Request, response: Response) {
  const item = notifications.find((entry) => entry.id === request.params.id);
  if (item) {
    item.read = true;
  }
  response.json({ ok: true });
}

export async function listFeedback(_request: Request, response: Response) {
  response.json({ feedback });
}

export async function createFeedback(request: Request, response: Response) {
  const item = {
    id: String(Date.now()),
    ...(request.body as Record<string, unknown>),
    status: "Mới",
    createdAt: new Date().toISOString(),
  };
  feedback.unshift(item);
  response.status(201).json({ feedback: item });
}

export async function updateFeedbackStatus(request: Request, response: Response) {
  const item = feedback.find((entry) => entry.id === request.params.id);
  if (item) {
    item.status = "Đã xử lý";
  }
  response.json({ ok: true });
}

export async function listShifts(_request: Request, response: Response) {
  response.json({ shifts });
}

export async function startShift(request: Request, response: Response) {
  const item = {
    id: String(Date.now()),
    ...(request.body as Record<string, unknown>),
    status: "Đang mở",
    startedAt: new Date().toISOString(),
  };
  shifts.unshift(item);
  response.status(201).json({ shift: item });
}

export async function endShift(request: Request, response: Response) {
  const item = shifts.find((entry) => entry.id === request.params.id);
  if (item) {
    item.status = "Đã đóng";
    item.endedAt = new Date().toISOString();
  }
  response.json({ ok: true });
}

export async function listIncidents(_request: Request, response: Response) {
  response.json({ incidents });
}

export async function createIncident(request: Request, response: Response) {
  const item = {
    id: String(Date.now()),
    ...(request.body as Record<string, unknown>),
    status: "Mới",
    createdAt: new Date().toISOString(),
  };
  incidents.unshift(item);
  response.status(201).json({ incident: item });
}

export async function resolveIncident(request: Request, response: Response) {
  const item = incidents.find((entry) => entry.id === request.params.id);
  if (item) {
    item.status = "Đã xử lý";
  }
  response.json({ ok: true });
}

export async function getReportSummary(request: Request, response: Response) {
  response.json({
    summary: {
      from: request.query.from || "",
      to: request.query.to || "",
      totalSessions: 0,
      totalRevenue: 0,
      completedSessions: 0,
    },
  });
}

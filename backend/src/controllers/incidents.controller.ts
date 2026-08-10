import { Request, Response } from "express";
import { z } from "zod";
import { Incident } from "../models/Incident.js";
import { createNotification } from "../services/notification.service.js";
import { serializeIncident } from "../utils/serializers.js";

export async function listIncidents(_request: Request, response: Response) {
  const incidents = await Incident.find().sort({ createdAt: -1 }).limit(200);
  response.json({ incidents: incidents.map(serializeIncident) });
}

export async function createIncident(request: Request, response: Response) {
  const body = z
    .object({
      type: z.enum(["Xe blacklist", "Lỗi nhận dạng", "Yêu cầu miễn phạt", "Camera offline", "Khác"]),
      note: z.string().min(2),
      plate: z.string().optional(),
      sessionId: z.string().optional(),
    })
    .parse(request.body);
  const incident = await Incident.create({
    ...body,
    createdBy: request.user?.id,
  });

  await createNotification({
    title: "Sự cố mới",
    content: `${body.type}: ${body.note}`,
    targetRole: "admin",
  });

  response.status(201).json({ incident: serializeIncident(incident) });
}

export async function updateIncident(request: Request, response: Response) {
  const body = z.object({ status: z.enum(["Mới", "Đang xử lý", "Đã xử lý"]) }).parse(request.body);
  const incident = await Incident.findByIdAndUpdate(
    request.params.id,
    {
      status: body.status,
      handledBy: request.user?.id,
      handledAt: body.status === "Đã xử lý" ? new Date() : undefined,
    },
    { returnDocument: "after" },
  );

  if (!incident) {
    response.status(404).json({ message: "Không tìm thấy sự cố." });
    return;
  }

  response.json({ incident: serializeIncident(incident) });
}

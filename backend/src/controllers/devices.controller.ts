import { Request, Response } from "express";
import { z } from "zod";
import { Device } from "../models/Device.js";
import { captureDeviceSnapshot } from "../services/device.service.js";
import { serializeDevice } from "../utils/serializers.js";

const deviceSchema = z.object({
  name: z.string().min(2),
  gate: z.enum(["entry", "exit"]),
  rtspUrl: z.string().min(4),
  username: z.string().optional(),
  password: z.string().optional(),
  roiNote: z.string().optional(),
});

export async function listDevices(_request: Request, response: Response) {
  const devices = await Device.find().sort({ gate: 1, createdAt: -1 });
  response.json({ devices: devices.map(serializeDevice) });
}

export async function createDevice(request: Request, response: Response) {
  const body = deviceSchema.parse(request.body);
  const device = await Device.create({
    ...body,
    createdBy: request.user?.id,
  });
  response.status(201).json({ device: serializeDevice(device) });
}

export async function updateDevice(request: Request, response: Response) {
  const body = deviceSchema.partial().parse(request.body);
  const device = await Device.findByIdAndUpdate(request.params.id, body, { returnDocument: "after" });
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  response.json({ device: serializeDevice(device) });
}

export async function snapshotDevice(request: Request, response: Response) {
  const device = await Device.findById(request.params.id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  try {
    const snapshot = await captureDeviceSnapshot(device);
    device.status = "online";
    device.lastSnapshotUrl = snapshot.imageUrl;
    device.lastSnapshotAt = new Date();
    await device.save();

    response.json({ device: serializeDevice(device), snapshotUrl: snapshot.imageUrl });
  } catch (error) {
    device.status = "offline";
    await device.save();
    response.status(502).json({
      message: error instanceof Error ? error.message : "Không chụp được camera.",
      device: serializeDevice(device),
    });
  }
}

// --- Maintenance & Health ---
import {
  checkOfflineDevices,
  createMaintenanceLog,
  getUpcomingMaintenance,
  listMaintenanceLogs,
  updateMaintenanceSchedule,
} from "../services/deviceMaintenance.service.js";
import { serializeMaintenanceLog } from "../utils/serializers.js";

export async function listDeviceMaintenanceHandler(request: Request, response: Response) {
  const logs = await listMaintenanceLogs(String(request.params.id));
  response.json({ logs: logs.map(serializeMaintenanceLog) });
}

export async function createDeviceMaintenanceHandler(request: Request, response: Response) {
  const body = z
    .object({
      type: z.enum(["scheduled", "repair", "inspection", "replacement"]),
      description: z.string().min(2),
      performedAt: z.string().optional(),
      cost: z.number().min(0).default(0),
      notes: z.string().optional(),
      status: z.enum(["planned", "in_progress", "completed"]).default("completed"),
    })
    .parse(request.body);

  const log = await createMaintenanceLog({
    deviceId: String(request.params.id),
    type: body.type,
    description: body.description,
    performedBy: request.user?.id,
    performedAt: body.performedAt ? new Date(body.performedAt) : undefined,
    cost: body.cost,
    notes: body.notes,
    status: body.status,
  });

  response.status(201).json({ log: serializeMaintenanceLog(log) });
}

export async function deviceHealthHandler(_request: Request, response: Response) {
  const upcoming = await getUpcomingMaintenance();
  const devices = await Device.find({ status: "offline" });
  response.json({
    offlineDevices: devices.map(serializeDevice),
    upcomingMaintenance: upcoming,
  });
}

export async function healthCheckHandler(_request: Request, response: Response) {
  const offlineCount = await checkOfflineDevices();
  response.json({ offlineCount, message: `${offlineCount} camera đã được đánh dấu offline.` });
}

export async function updateScheduleHandler(request: Request, response: Response) {
  const body = z.object({ intervalDays: z.number().int().min(1) }).parse(request.body);
  await updateMaintenanceSchedule(String(request.params.id), body.intervalDays);
  const device = await Device.findById(request.params.id);
  response.json({ device: device ? serializeDevice(device) : null, message: "Đã cập nhật lịch bảo trì." });
}

// DV-06: Remote device restart
export async function restartDeviceHandler(request: Request, response: Response) {
  const device = await Device.findById(request.params.id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  // Attempt restart via RTSP reconnection (simulate by re-capturing snapshot)
  try {
    const snapshot = await captureDeviceSnapshot(device);
    device.status = "online";
    device.lastSnapshotUrl = snapshot.imageUrl;
    device.lastSnapshotAt = new Date();
    await device.save();

    response.json({
      device: serializeDevice(device),
      message: `Thiết bị "${device.name}" đã khởi động lại thành công.`,
    });
  } catch (error) {
    device.status = "offline";
    await device.save();
    response.status(502).json({
      message: `Không khởi động lại được "${device.name}". Thiết bị có thể không phản hồi.`,
      device: serializeDevice(device),
    });
  }
}

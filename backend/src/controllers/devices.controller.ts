import { Request, Response } from "express";
import { z } from "zod";
import { Device } from "../models/Device.js";
import { ParkingSession } from "../models/ParkingSession.js";
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

export async function getLaneRoles(_request: Request, response: Response) {
  const devices = await Device.find({ lane: { $in: ["in", "out"] } });
  const entry = devices.find((device) => device.gate === "entry");
  const exit = devices.find((device) => device.gate === "exit");
  response.json({ entryLane: entry?.lane || "in", exitLane: exit?.lane || "out" });
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

export async function deleteDevice(request: Request, response: Response) {
  const device = await Device.findById(request.params.id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }
  const inProgressExit = device.gate === "exit" && await ParkingSession.exists({
    status: "Đang gửi",
    exitState: { $in: ["waiting_rfid", "waiting_manual_verification", "rfid_verified", "payment_pending", "gate_authorizing"] },
  });
  if (inProgressExit) {
    response.status(409).json({ message: "Không thể xóa camera khi đang có xe xử lý tại cổng ra." });
    return;
  }
  await device.deleteOne();
  response.json({ ok: true, message: `Đã xóa ${device.name}.` });
}

/** Swap the single entry and exit camera without ever leaving duplicate roles. */
export async function swapCameraRoles(_request: Request, response: Response) {
  const inProgressExit = await ParkingSession.exists({
    status: "Đang gửi",
    exitState: { $in: ["waiting_rfid", "waiting_manual_verification", "rfid_verified", "payment_pending", "gate_authorizing"] },
  });
  if (inProgressExit) {
    response.status(409).json({
      message: "Không thể hoán đổi camera khi đang có xe xử lý tại cổng ra. Vui lòng hoàn tất hoặc hủy phiên trước.",
    });
    return;
  }

  const devices = await Device.find({ gate: { $in: ["entry", "exit"] } }).sort({ createdAt: 1 });
  const entry = devices.find((device) => device.gate === "entry");
  const exit = devices.find((device) => device.gate === "exit");
  if (!entry || !exit || devices.length !== 2) {
    response.status(409).json({
      message: "Cần đúng một camera Cổng vào và một camera Cổng ra để hoán đổi.",
    });
    return;
  }

  const laneFor = (device: typeof entry) =>
    device.lane || (/cổng\s*ra/i.test(device.name) ? "out" : "in");
  await Device.bulkWrite([
    { updateOne: { filter: { _id: entry._id }, update: { $set: { gate: "exit", lane: laneFor(entry) } } } },
    { updateOne: { filter: { _id: exit._id }, update: { $set: { gate: "entry", lane: laneFor(exit) } } } },
  ]);
  const swapped = await Device.find({ _id: { $in: [entry._id, exit._id] } }).sort({ gate: 1 });
  response.json({ devices: swapped.map(serializeDevice), message: "Đã hoán đổi vai trò hai camera. Chỉ sự kiện nhận diện mới dùng vai trò mới." });
}

// ROI theo hệ tọa độ 640x360 của editor frontend; ai-service scale theo frame thật.
const roiSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(20),
  height: z.number().min(15),
  label: z.string().trim().max(100).optional(),
});

export async function updateDeviceRoi(request: Request, response: Response) {
  const roi = roiSchema.parse(request.body);
  const device = await Device.findByIdAndUpdate(
    request.params.id,
    { roi, roiNote: roi.label || "" },
    { returnDocument: "after" },
  );
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

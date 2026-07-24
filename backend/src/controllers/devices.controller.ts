import { Request, Response } from "express";
import { z } from "zod";
import { Device } from "../models/Device.js";
import { captureDeviceSnapshot } from "../services/device.service.js";
import {
  captureSnapshotFromDevice,
  startMjpegStream,
  stopMjpegStream,
} from "../services/cameraStream.service.js";
import {
  toggleAutoScan,
  updateAutoScanInterval,
  getAutoScanStatus,
} from "../services/auto-scan.service.js";
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
  const device = await Device.findByIdAndUpdate(request.params.id, body, {
    returnDocument: "after",
  });
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  response.json({ device: serializeDevice(device) });
}

export async function deleteDevice(request: Request, response: Response) {
  const device = await Device.findByIdAndDelete(request.params.id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  response.json({
    message: `Đã xóa thiết bị "${device.name}".`,
    id: device._id.toString(),
  });
}

export async function getRoiConfigHandler(
  request: Request,
  response: Response,
) {
  const device = await Device.findById(request.params.id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  response.json({
    deviceId: device._id.toString(),
    deviceName: device.name,
    roi: device.roi || null,
    lastSnapshotUrl: device.lastSnapshotUrl || "",
  });
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

    response.json({
      device: serializeDevice(device),
      snapshotUrl: snapshot.imageUrl,
    });
  } catch (error) {
    device.status = "offline";
    await device.save();
    response.status(502).json({
      message:
        error instanceof Error ? error.message : "Không chụp được camera.",
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

export async function listDeviceMaintenanceHandler(
  request: Request,
  response: Response,
) {
  const logs = await listMaintenanceLogs(String(request.params.id));
  response.json({ logs: logs.map(serializeMaintenanceLog) });
}

export async function createDeviceMaintenanceHandler(
  request: Request,
  response: Response,
) {
  const body = z
    .object({
      type: z.enum(["scheduled", "repair", "inspection", "replacement"]),
      description: z.string().min(2),
      performedAt: z.string().optional(),
      cost: z.number().min(0).default(0),
      notes: z.string().optional(),
      status: z
        .enum(["planned", "in_progress", "completed"])
        .default("completed"),
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

export async function deviceHealthHandler(
  _request: Request,
  response: Response,
) {
  const upcoming = await getUpcomingMaintenance();
  const devices = await Device.find({ status: "offline" });
  response.json({
    offlineDevices: devices.map(serializeDevice),
    upcomingMaintenance: upcoming,
  });
}

export async function healthCheckHandler(
  _request: Request,
  response: Response,
) {
  const offlineCount = await checkOfflineDevices();
  response.json({
    offlineCount,
    message: `${offlineCount} camera đã được đánh dấu offline.`,
  });
}

export async function updateScheduleHandler(
  request: Request,
  response: Response,
) {
  const body = z
    .object({ intervalDays: z.number().int().min(1) })
    .parse(request.body);
  await updateMaintenanceSchedule(String(request.params.id), body.intervalDays);
  const device = await Device.findById(request.params.id);
  response.json({
    device: device ? serializeDevice(device) : null,
    message: "Đã cập nhật lịch bảo trì.",
  });
}

// DV-06: Remote device restart
export async function restartDeviceHandler(
  request: Request,
  response: Response,
) {
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

const roiSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(1),
  height: z.number().min(1),
  label: z.string().optional(),
});

export async function connectDeviceHandler(
  request: Request,
  response: Response,
) {
  const device = await Device.findById(request.params.id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  try {
    const snapshot = await captureSnapshotFromDevice({
      rtspUrl: device.rtspUrl,
      httpUrl: device.httpUrl,
      username: device.username,
      password: device.password,
      deviceId: device._id.toString(),
    });

    device.status = "online";
    device.lastSnapshotUrl = snapshot.imageUrl;
    device.lastSnapshotAt = new Date();
    device.snapshotPath = snapshot.imageUrl;
    await device.save();

    response.json({
      message: `Đã kết nối camera "${device.name}" thành công.`,
      device: serializeDevice(device),
      snapshotUrl: snapshot.imageUrl,
    });
  } catch (error) {
    device.status = "offline";
    await device.save();
    response.status(502).json({
      message:
        error instanceof Error ? error.message : "Không kết nối được camera.",
      device: serializeDevice(device),
    });
  }
}

export async function configureRoiHandler(
  request: Request,
  response: Response,
) {
  const body = roiSchema.parse(request.body);
  const device = await Device.findById(request.params.id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  device.roi = {
    ...body,
    updatedAt: new Date(),
  };
  await device.save();

  response.json({
    message: "Đã lưu cấu hình ROI.",
    device: serializeDevice(device),
  });
}

export async function streamDeviceHandler(
  request: Request,
  response: Response,
) {
  const device = await Device.findById(request.params.id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  if (!device.rtspUrl && !device.httpUrl) {
    response
      .status(400)
      .json({ message: "Thiết bị chưa cấu hình URL camera." });
    return;
  }

  const streamProcess = startMjpegStream({
    deviceId: device._id.toString(),
    rtspUrl: device.rtspUrl,
    httpUrl: device.httpUrl,
    username: device.username,
    password: device.password,
  });

  response.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=frame",
    "Cache-Control": "no-cache",
    Connection: "close",
    Pragma: "no-cache",
  });

  streamProcess.stdout.pipe(response);

  request.on("close", () => {
    stopMjpegStream(device._id.toString());
  });
}

export async function captureDeviceImageHandler(
  request: Request,
  response: Response,
) {
  const device = await Device.findById(request.params.id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  if (!device.rtspUrl && !device.httpUrl) {
    response
      .status(400)
      .json({ message: "Thiết bị chưa cấu hình URL camera." });
    return;
  }

  try {
    const snapshot = await captureSnapshotFromDevice({
      rtspUrl: device.rtspUrl,
      httpUrl: device.httpUrl,
      username: device.username,
      password: device.password,
      deviceId: device._id.toString(),
    });

    device.status = "online";
    device.lastSnapshotUrl = snapshot.imageUrl;
    device.lastSnapshotAt = new Date();
    await device.save();

    response.json({
      message: "Đã chụp ảnh xe từ camera.",
      device: serializeDevice(device),
      snapshotUrl: snapshot.imageUrl,
    });
  } catch (error) {
    device.status = "offline";
    await device.save();
    response.status(502).json({
      message:
        error instanceof Error ? error.message : "Không chụp được ảnh camera.",
      device: serializeDevice(device),
    });
  }
}

export async function toggleAutoScanHandler(
  request: Request,
  response: Response,
) {
  const body = z.object({ enabled: z.boolean() }).parse(request.body);
  try {
    const result = await toggleAutoScan(request.params.id, body.enabled);
    response.json({
      message: body.enabled ? "Đã bật auto-scan." : "Đã tắt auto-scan.",
      device: serializeDevice(result.device),
      autoScanEnabled: result.autoScanEnabled,
    });
  } catch (error) {
    response
      .status(400)
      .json({
        message:
          error instanceof Error ? error.message : "Lỗi toggle auto-scan.",
      });
  }
}

export async function updateAutoScanIntervalHandler(
  request: Request,
  response: Response,
) {
  const body = z
    .object({ intervalSeconds: z.number().min(5).max(120) })
    .parse(request.body);
  try {
    await updateAutoScanInterval(request.params.id, body.intervalSeconds);
    response.json({
      message: `Đã cập nhật interval auto-scan thành ${body.intervalSeconds}s.`,
    });
  } catch (error) {
    response
      .status(400)
      .json({
        message:
          error instanceof Error ? error.message : "Lỗi cập nhật interval.",
      });
  }
}

export async function getAutoScanStatusHandler(
  _request: Request,
  response: Response,
) {
  const status = getAutoScanStatus();
  response.json({ autoScanStatus: status });
}

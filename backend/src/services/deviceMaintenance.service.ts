import mongoose from "mongoose";
import { Device } from "../models/Device.js";
import { DeviceMaintenanceLog, DeviceMaintenanceLogDocument } from "../models/DeviceMaintenanceLog.js";
import { createNotification } from "./notification.service.js";

export async function createMaintenanceLog(params: {
  deviceId: string;
  type: "scheduled" | "repair" | "inspection" | "replacement";
  description: string;
  performedBy?: string;
  performedAt?: Date;
  cost?: number;
  notes?: string;
  status?: "planned" | "in_progress" | "completed";
}): Promise<DeviceMaintenanceLogDocument> {
  const device = await Device.findById(params.deviceId);
  if (!device) {
    const err = new Error("Thiết bị không tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  const log = await DeviceMaintenanceLog.create({
    deviceId: device._id,
    deviceName: device.name,
    type: params.type,
    description: params.description,
    performedBy: params.performedBy
      ? new mongoose.Types.ObjectId(params.performedBy)
      : undefined,
    performedAt: params.performedAt || new Date(),
    cost: params.cost ?? 0,
    notes: params.notes,
    status: params.status ?? "completed",
  });

  // Update device maintenance schedule
  if (params.status === "completed" || !params.status) {
    const now = new Date();
    const intervalDays = device.maintenanceSchedule?.intervalDays ?? 30;
    const nextDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    await Device.findByIdAndUpdate(device._id, {
      $set: {
        "maintenanceSchedule.lastMaintenanceAt": now,
        "maintenanceSchedule.nextMaintenanceAt": nextDate,
      },
    });
  }

  return log;
}

export async function listMaintenanceLogs(
  deviceId?: string,
): Promise<DeviceMaintenanceLogDocument[]> {
  const query: Record<string, unknown> = {};
  if (deviceId && mongoose.isValidObjectId(deviceId)) {
    query.deviceId = new mongoose.Types.ObjectId(deviceId);
  }
  return DeviceMaintenanceLog.find(query).sort({ performedAt: -1 }).limit(100);
}

export async function getUpcomingMaintenance(): Promise<
  { deviceId: string; deviceName: string; nextMaintenanceAt: Date; overdue: boolean }[]
> {
  const devices = await Device.find({
    "maintenanceSchedule.nextMaintenanceAt": { $exists: true },
  }).sort({ "maintenanceSchedule.nextMaintenanceAt": 1 });

  const now = new Date();
  return devices.map((d) => ({
    deviceId: d._id.toString(),
    deviceName: d.name,
    nextMaintenanceAt: d.maintenanceSchedule!.nextMaintenanceAt!,
    overdue: d.maintenanceSchedule!.nextMaintenanceAt! < now,
  }));
}

/**
 * Check all devices for offline status based on lastSnapshotAt threshold.
 * Returns count of devices marked offline.
 */
export async function checkOfflineDevices(): Promise<number> {
  const devices = await Device.find({ healthCheckEnabled: true });
  const now = new Date();
  let offlineCount = 0;

  for (const device of devices) {
    const threshold = device.offlineThresholdMinutes || 30;
    const cutoff = new Date(now.getTime() - threshold * 60 * 1000);

    if (!device.lastSnapshotAt || device.lastSnapshotAt < cutoff) {
      if (device.status !== "offline") {
        device.status = "offline";
        await device.save();
        offlineCount++;
      }
    }
  }

  if (offlineCount > 0) {
    await createNotification({
      title: "Camera offline",
      content: `${offlineCount} camera đã chuyển sang trạng thái offline.`,
      targetRole: "admin",
    });
  }

  return offlineCount;
}

export async function updateMaintenanceSchedule(
  deviceId: string,
  intervalDays: number,
): Promise<void> {
  const device = await Device.findById(deviceId);
  if (!device) {
    const err = new Error("Thiết bị không tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  const lastMaintenance = device.maintenanceSchedule?.lastMaintenanceAt || new Date();
  const nextDate = new Date(lastMaintenance.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  await Device.findByIdAndUpdate(deviceId, {
    $set: {
      "maintenanceSchedule.intervalDays": intervalDays,
      "maintenanceSchedule.nextMaintenanceAt": nextDate,
    },
  });
}

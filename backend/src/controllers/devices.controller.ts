import { Request, Response } from "express";
import { Device } from "../models/Device.js";

export async function listDevices(_request: Request, response: Response) {
  const devices = await Device.find({}).sort({ createdAt: -1 }).limit(100);
  response.json({
    devices: devices.map((device) => ({
      id: device._id.toString(),
      name: device.name,
      gate: device.gate,
      status: device.status,
      lastSnapshotUrl: device.lastSnapshotUrl,
      lastSnapshotAt: device.lastSnapshotAt,
    })),
  });
}

export async function saveDevice(request: Request, response: Response) {
  const body = request.body as { id?: string; name: string; gate: "entry" | "exit" };
  const device = body.id
    ? await Device.findByIdAndUpdate(body.id, { name: body.name, gate: body.gate }, { new: true })
    : await Device.create({ name: body.name, gate: body.gate, status: "offline" });

  response.json({
    device: {
      id: device?._id.toString(),
      name: device?.name,
      gate: device?.gate,
      status: device?.status,
    },
  });
}

export async function snapshotDevice(request: Request, response: Response) {
  const device = await Device.findById(request.params.id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }

  device.status = "online";
  device.lastSnapshotAt = new Date();
  await device.save();
  response.json({ ok: true, deviceId: device._id.toString() });
}

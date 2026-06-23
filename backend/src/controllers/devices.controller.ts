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
  const device = await Device.findByIdAndUpdate(request.params.id, body, { new: true });
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

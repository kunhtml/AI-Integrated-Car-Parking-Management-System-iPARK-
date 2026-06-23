import { Request, Response } from "express";
import { Device } from "../models/Device.js";

export async function listDevices(_request: Request, response: Response) {
  const devices = await Device.find({}).sort({ createdAt: -1 }).limit(100);
  response.json({
    devices: devices.map((device) => ({
      id: device._id.toString(),
      name: device.name,
      gate: device.gate,
      rtspUrl: device.rtspUrl || "",
      username: device.username || "",
      password: device.password || "",
      roiNote: device.roiNote || "Biển số trước",
      status: device.status,
      lastSnapshotUrl: device.lastSnapshotUrl || "",
      lastSnapshotAt: device.lastSnapshotAt,
    })),
  });
}

export async function saveDevice(request: Request, response: Response) {
  const body = request.body as {
    id?: string;
    name: string;
    gate: "entry" | "exit";
    rtspUrl?: string;
    username?: string;
    password?: string;
    roiNote?: string;
  };

  const updateData = {
    name: body.name,
    gate: body.gate,
    rtspUrl: body.rtspUrl || "",
    username: body.username || "",
    password: body.password || "",
    roiNote:
      body.roiNote || (body.gate === "entry" ? "Biển số trước" : "Biển số sau"),
  };

  const device = body.id
    ? await Device.findByIdAndUpdate(body.id, updateData, { new: true })
    : await Device.create({ ...updateData, status: "offline" });

  response.json({
    device: {
      id: device?._id.toString(),
      name: device?.name,
      gate: device?.gate,
      rtspUrl: device?.rtspUrl,
      username: device?.username,
      password: device?.password,
      roiNote: device?.roiNote,
      status: device?.status,
      lastSnapshotUrl: device?.lastSnapshotUrl || "",
      lastSnapshotAt: device?.lastSnapshotAt,
    },
  });
}

export async function deleteDevice(request: Request, response: Response) {
  const { id } = request.params;
  const device = await Device.findByIdAndDelete(id);
  if (!device) {
    response.status(404).json({ message: "Không tìm thấy thiết bị." });
    return;
  }
  response.json({ success: true, message: "Đã xóa thiết bị thành công." });
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

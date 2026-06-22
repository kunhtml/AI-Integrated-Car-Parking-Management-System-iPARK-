import type { DeviceDocument } from "../models/Device.js";

export async function captureDeviceSnapshot(device: DeviceDocument) {
  const placeholder = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#111827"/><text x="50%" y="50%" fill="#fff" font-size="24" text-anchor="middle">${device.name}</text></svg>`,
    "utf8",
  );

  return {
    buffer: placeholder,
    mimetype: "image/svg+xml",
    imageUrl: device.lastSnapshotUrl || `/uploads/devices/${device._id.toString()}.svg`,
  };
}

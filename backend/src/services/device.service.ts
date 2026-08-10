import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { DeviceDocument } from "../models/Device.js";

export type SnapshotResult = {
  buffer: Buffer;
  mimetype: string;
  imageUrl: string;
};

export async function captureDeviceSnapshot(device: DeviceDocument): Promise<SnapshotResult> {
  const response = await fetch(`${env.aiServiceUrl}/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rtspUrl: device.rtspUrl,
      username: device.username,
      password: device.password,
    }),
  });

  const data = (await response.json()) as {
    imageBase64?: string;
    contentType?: string;
    message?: string;
  };

  if (!response.ok || !data.imageBase64) {
    throw new Error(data.message || "Không chụp được ảnh từ camera.");
  }

  const buffer = Buffer.from(data.imageBase64, "base64");
  const uploadDir = path.join(process.cwd(), "uploads", "snapshots");
  await mkdir(uploadDir, { recursive: true });
  const fileName = `${randomUUID()}.jpg`;
  await writeFile(path.join(uploadDir, fileName), buffer);

  return {
    buffer,
    mimetype: data.contentType || "image/jpeg",
    imageUrl: `/uploads/snapshots/${fileName}`,
  };
}

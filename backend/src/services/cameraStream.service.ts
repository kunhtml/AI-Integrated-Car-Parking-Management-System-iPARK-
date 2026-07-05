import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import ffmpegPath from "ffmpeg-static";

type StreamEntry = {
  process: ChildProcess;
  viewers: number;
  createdAt: Date;
};

const streams = new Map<string, StreamEntry>();
const SNAPSHOT_DIR = path.join(process.cwd(), "uploads", "devices");

function buildInputUrl(params: {
  rtspUrl?: string;
  httpUrl?: string;
  username?: string;
  password?: string;
}) {
  const url = params.httpUrl || params.rtspUrl || "";
  if (!url) {
    throw new Error("Chưa cấu hình URL camera.");
  }

  if (params.username && url.includes("://")) {
    const [scheme, rest] = url.split("://", 2);
    const auth = params.password ? `${params.username}:${params.password}` : params.username;
    return `${scheme}://${auth}@${rest}`;
  }

  return url;
}

function startFfmpeg(args: string[]) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static chưa được cài đặt. Không phát được stream camera.");
  }

  return spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
}

export async function captureSnapshotFromDevice(params: {
  rtspUrl?: string;
  httpUrl?: string;
  username?: string;
  password?: string;
  deviceId: string;
}): Promise<{ buffer: Buffer; imageUrl: string }> {
  const inputUrl = buildInputUrl(params);
  const outputDir = SNAPSHOT_DIR;
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${params.deviceId}-${Date.now()}.jpg`);

  await new Promise<void>((resolve, reject) => {
    const process = startFfmpeg([
      "-rtsp_transport",
      "tcp",
      "-i",
      inputUrl,
      "-frames:v",
      "1",
      "-y",
      outputPath,
    ]);

    let stderr = "";
    process.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Không chụp được ảnh camera. ffmpeg exit code=${code}. ${stderr}`));
      }
    });

    process.on("error", reject);
  });

  const buffer = await fs.readFile(outputPath);
  const imageUrl = `/uploads/devices/${path.basename(outputPath)}`;
  return { buffer, imageUrl };
}

export function startMjpegStream(params: {
  deviceId: string;
  rtspUrl?: string;
  httpUrl?: string;
  username?: string;
  password?: string;
}) {
  const existing = streams.get(params.deviceId);
  if (existing) {
    existing.viewers += 1;
    return existing.process;
  }

  const inputUrl = buildInputUrl(params);
  const process = startFfmpeg([
    "-rtsp_transport",
    "tcp",
    "-i",
    inputUrl,
    "-f",
    "mpjpeg",
    "-q:v",
    "3",
    "-r",
    "8",
    "pipe:1",
  ]);

  streams.set(params.deviceId, {
    process,
    viewers: 1,
    createdAt: new Date(),
  });

  process.on("close", () => {
    streams.delete(params.deviceId);
  });

  process.on("error", () => {
    streams.delete(params.deviceId);
  });

  return process;
}

export function stopMjpegStream(deviceId: string) {
  const entry = streams.get(deviceId);
  if (!entry) {
    return;
  }

  entry.viewers = Math.max(0, entry.viewers - 1);
  if (entry.viewers === 0) {
    entry.process.kill("SIGTERM");
    streams.delete(deviceId);
  }
}

export function getStreamEntry(deviceId: string) {
  return streams.get(deviceId) || null;
}

import { Queue, Worker, Job } from "bullmq";
import { detectVehicleImage } from "../services/ai.service.js";
import { safeCreateRecognitionLog } from "../services/recognitionLog.service.js";
import { captureDeviceSnapshot } from "../services/device.service.js";
import { Device } from "../models/Device.js";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null as null,
};

let redisAvailable = false;
let detectQueue: Queue | null = null;

async function checkRedis(): Promise<boolean> {
  try {
    const net = await import("net");
    return await new Promise((resolve) => {
      const socket = net.createConnection(
        { host: connection.host, port: connection.port, timeout: 3000 },
        () => {
          socket.destroy();
          resolve(true);
        },
      );
      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

try {
  const ok = await checkRedis();
  if (ok) {
    redisAvailable = true;
    detectQueue = new Queue("detect-plate", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
    console.log("[detect-queue] Redis connected — async queue enabled");
  } else {
    console.log("[detect-queue] Redis not available — using synchronous fallback");
  }
} catch {
  console.log("[detect-queue] Redis not available — using synchronous fallback");
}

export { redisAvailable, detectQueue };

export async function addDetectJob(data: Record<string, unknown>) {
  if (detectQueue) {
    return detectQueue.add("detect-plate", data);
  }
  // Synchronous fallback: process immediately
  return processDetectLogic(data);
}

interface DetectJobData {
  action?: string;
  source?: string;
  deviceId?: string;
  deviceName?: string;
  imageBase64?: string;
  trigger?: string;
  triggerTimestamp?: string;
  sessionId?: string;
  [key: string]: unknown;
}

async function processDetectLogic(data: Record<string, unknown>) {
  const {
    deviceId: rawDeviceId,
    action = "camera-motion",
    source = "camera",
    imageBase64,
    deviceName: rawDeviceName,
    sessionId: rawSessionId,
    ...rest
  } = data;
  const deviceId = typeof rawDeviceId === "string" ? rawDeviceId : undefined;
  const deviceName = typeof rawDeviceName === "string" ? rawDeviceName : undefined;
  const sessionId = typeof rawSessionId === "string" ? rawSessionId : undefined;

  let imageBuffer: Buffer | null = null;

  try {
    if (imageBase64 && typeof imageBase64 === "string") {
      imageBuffer = Buffer.from(imageBase64, "base64");
    } else if (deviceId) {
      const device = await Device.findById(deviceId);
      if (device) {
        const snapshot = await captureDeviceSnapshot(device);
        imageBuffer = snapshot.buffer;

        device.status = "online";
        device.lastSnapshotUrl = snapshot.imageUrl;
        device.lastSnapshotAt = new Date();
        await device.save().catch(() => {});
      }
    }
  } catch (err) {
    console.error("[detect-queue] Failed to obtain image:", err);
  }

  if (!imageBuffer) {
    await safeCreateRecognitionLog({
      action: action as any,
      source: source as any,
      status: "failed",
      deviceId,
      deviceName,
      sessionId,
      detectionMethod: "camera",
      message: "Detection failed: no image data available",
      ...rest,
    });
    return { ok: false, reason: "no-image" };
  }

  const detection = await detectVehicleImage(
    {
      buffer: imageBuffer,
      mimetype: "image/jpeg",
      originalname: "async-detect.jpg",
    } as any,
  );

  const finalMethod = detection.detectionMethod || "camera";

  await safeCreateRecognitionLog({
    action: action as any,
    source: source as any,
    status: detection.plate ? "success" : "failed",
    plate: detection.plate || undefined,
    detectedPlate: detection.plate || undefined,
    confidence: detection.confidence,
    rawText: detection.rawText,
    imageHash: detection.imageHash,
    imageUrl: undefined,
    vehicleType: detection.vehicleType,
    detectionMethod: finalMethod,
    deviceId,
    deviceName,
    sessionId,
    message: detection.plate
      ? `${action} detected plate ${detection.plate} via ${finalMethod}`
      : `${action}: no plate detected`,
    ...rest,
  });

  console.log(
    `[detect-queue] Processed: plate=${detection.plate || "none"} method=${finalMethod}`,
  );

  return {
    ok: true,
    plate: detection.plate,
    detectionMethod: finalMethod,
    confidence: detection.confidence,
  };
}

let workerInstance: Worker | null = null;

export function startDetectWorker(): void {
  if (!redisAvailable || !detectQueue || workerInstance) return;

  workerInstance = new Worker(
    "detect-plate",
    async (job: Job<DetectJobData>) => {
      return processDetectLogic(job.data || {});
    },
    {
      connection,
      concurrency: 2,
    },
  );

  workerInstance.on("completed", (job) => {
    console.log(`[detect-queue] Completed job ${job?.id}`);
  });

  workerInstance.on("failed", (job, err) => {
    console.error(
      `[detect-queue] Failed job ${job?.id}:`,
      err?.message || err,
    );
  });

  console.log("[detect-queue] Worker listening for detect-plate jobs");
}

export async function stopDetectWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    console.log("[detect-queue] Worker stopped");
  }
}

export default { detectQueue, addDetectJob, startDetectWorker, stopDetectWorker };

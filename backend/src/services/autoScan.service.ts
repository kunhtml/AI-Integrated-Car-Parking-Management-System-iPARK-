import { Device } from "../models/Device.js";
import { captureDeviceSnapshot } from "./device.service.js";
import { detectVehicleImage } from "./ai.service.js";
import { createRecognitionLog, safeCreateRecognitionLog } from "./recognitionLog.service.js";
import { Device } from "../models/Device.js";
import { ParkingSession, ParkingSessionDocument } from "../models/ParkingSession.js";
import { Vehicle } from "../models/Vehicle.js";
import { createNotification } from "./notification.service.js";
import { imageHashSimilarity, platesMatch } from "./plate.service.js";
import { calculateParkingFee, getActivePricingConfig } from "./pricing.service.js";
import { createPendingTransactionForSession, objectId } from "./transaction.service.js";
import { serializeParkingSession } from "../utils/serializers.js";

const AUTO_SCAN_INTERVALS = new Map<string, NodeJS.Timeout>();

interface AutoScanOptions {
  intervalMs?: number;
  enabled?: boolean;
}

let globalAutoScanEnabled = true;

export async function toggleAutoScan(deviceId: string, enabled: boolean, intervalMs = 5000) {
  if (enabled) {
    return startAutoScan(deviceId);
  } else {
    return stopAutoScan(deviceId);
  }
}

export async function startAutoScan(deviceId: string, intervalMs = 5000) {
  // Stop existing if running
  stopAutoScan(deviceId);

  const device = await Device.findById(deviceId);
  if (!device || !device.rtspUrl) {
    console.log(`[AutoScan] Device ${deviceId} not found or no RTSP URL`);
    return false;
  }

  const interval = setInterval(async () => {
    if (!globalAutoScanEnabled) return;

    try {
      const device = await Device.findById(deviceId);
      if (!device || !device.rtspUrl) return;

      // Capture snapshot
      const { captureDeviceSnapshot } = await import("./device.service.js");
      const snapshot = await captureDeviceSnapshot({
        rtspUrl: device.rtspUrl,
        username: device.username,
        password: device.password,
        deviceId: deviceId,
      });

      device.status = "online";
      device.lastSnapshotUrl = snapshot.imageUrl;
      device.lastSnapshotAt = new Date();
      await device.save();

      // Detect vehicle
      const { detectVehicleImage } = await import("./ai.service.js");
      const fakeFile = { buffer: snapshot.buffer, originalname: "snapshot.jpg" } as any;
      const detection = await detectVehicleImage(fakeFile);

      if (!detection.plate) {
        await safeCreateRecognitionLog({
          action: "camera-scan",
          source: "camera",
          status: "failed",
          confidence: detection.confidence,
          rawText: detection.rawText,
          imageHash: detection.imageHash,
          detectionMethod: detection.detectionMethod,
          deviceId: device._id,
          deviceName: device.name,
          message: "No plate detected in auto-scan",
        });
        return;
      }

      // Log successful detection
      await safeCreateRecognitionLog({
        action: "auto-scan",
        source: "camera",
        status: "success",
        plate: detection.plate,
        detectedPlate: detection.plate,
        confidence: detection.confidence,
        rawText: detection.rawText,
        imageHash: detection.imageHash,
        detectionMethod: detection.detectionMethod,
        imageUrl: device.lastSnapshotUrl,
        vehicleType: detection.vehicleType,
        deviceId: device._id,
        deviceName: device.name,
        message: "Auto-scan detection",
      });

      // Process based on gate type
      const deviceDoc = await Device.findById(device._id);
      if (device.gate === "entry") {
        await handleAutoEntry(device, detection, snapshot);
      } else if (device.gate === "exit") {
        await handleAutoExit(device, detection);
      }
    } catch (error) {
      console.error("[AutoScan] Error:", error);
    }
  }, intervalMs);

  console.log(`[AutoScan] Started for device ${deviceId} at ${intervalMs}ms interval`);
  return true;
}

export function stopAutoScan(deviceId: string) {
  const interval = AUTO_SCAN_INTERVALS.get(deviceId);
  if (interval) {
    clearInterval(interval);
    AUTO_SCAN_INTERVALS.delete(deviceId);
    console.log(`[AutoScan] Stopped for device ${deviceId}`);
  }
}

export function stopAllAutoScans() {
  for (const [deviceId, interval] of AUTO_SCAN_INTERVALS) {
    clearInterval(interval);
  }
  AUTO_SCAN_INTERVALS.clear();
  console.log("[AutoScan] All scans stopped");
}

export function isAutoScanRunning(deviceId: string): boolean {
  return AUTO_SCAN_INTERVALS.has(deviceId);
}

export function setGlobalAutoScanEnabled(enabled: boolean) {
  globalAutoScanEnabled = enabled;
}

export function getAutoScanStatus(deviceId: string) {
  return {
    running: AUTO_SCAN_INTERVALS.has(deviceId),
    globalEnabled: globalAutoScanEnabled,
  };
}
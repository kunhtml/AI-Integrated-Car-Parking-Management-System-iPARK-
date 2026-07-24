import { Device } from "../models/Device.js";
import { ParkingSession, ParkingSessionDocument } from "../models/ParkingSession.js";
import { Vehicle } from "../models/Vehicle.js";
import { captureDeviceSnapshot } from "./device.service.js";
import { detectVehicleImage } from "./ai.service.js";
import { createNotification } from "./notification.service.js";
import { imageHashSimilarity, platesMatch } from "./plate.service.js";
import { calculateParkingFee, getActivePricingConfig } from "./pricing.service.js";
import { createPendingTransactionForSession, objectId } from "./transaction.service.js";
import { serializeParkingSession } from "../utils/serializers.js";
import { addDetectJob } from "../queues/detect.queue.js";
import { safeCreateRecognitionLog } from "./recognitionLog.service.js";

interface OnvifMotionEvent {
  event: string;
  timestamp: string;
  confidence?: number;
  rawText?: string;
  imageHash?: string;
  imageUrl?: string;
  vehicleType?: string;
  sessionId?: string;
  deviceId?: string;
  deviceName?: string;
  matched?: boolean;
  matchStatus?: "Chưa checkout" | "Khớp" | "Không khớp";
  vehicleMatchScore?: number;
  message?: string;
  createdBy?: string;
  plate?: string;
}

export async function handleOnvifMotionEvent(deviceId: string, eventData: any) {
  try {
    const device = await Device.findById(deviceId);
    if (!device) {
      console.error(`[ONVIF] Device ${deviceId} not found`);
      return;
    }

    // Ghi log pending ngay (với detectionMethod rõ ràng)
    await safeCreateRecognitionLog({
      action: "camera-motion",
      source: "camera",
      status: "pending",
      deviceId,
      deviceName: device.name,
      detectionMethod: "camera",
      message: "ONVIF MotionAlarm event received",
    });

    // Xử lý detection — async nếu có Redis, sync nếu không
    await addDetectJob({
      action: "camera-motion",
      source: "camera",
      deviceId,
      deviceName: device.name,
      trigger: "onvif_motion",
      triggerTimestamp: new Date().toISOString(),
      detectionMethod: "camera",
    });

    console.log(`[ONVIF] Motion event queued for device ${deviceId}`);
  } catch (error) {
    console.error("[ONVIF Motion] Error:", error);
  }
}

export async function handleOnvifEvent(deviceId: string, eventData: any) {
  const device = await Device.findById(deviceId);
  if (!device) return;

  // Parse ONVIF event data
  const event = eventData?.event || eventData?.event?.topic || eventData?.topic;
  const message =
    eventData?.message || eventData?.message?.value || "";

  // Check if it's a motion alarm event
  const isMotionEvent =
    eventData?.event?.topic?.includes("MotionAlarm") ||
    eventData?.topic?.includes("MotionAlarm") ||
    message?.includes("MotionAlarm") ||
    eventData?.MotionAlarm === true ||
    eventData?.event?.message?.value === "true";

  if (!isMotionEvent) {
    console.log(`[ONVIF] Non-motion event received from ${device.name}:`, event);
    return;
  }

  console.log(`[ONVIF] Motion event received from ${device.name}`);

  // Ghi log pending
  await safeCreateRecognitionLog({
    action: "camera-motion",
    source: "camera",
    status: "pending",
    deviceId,
    deviceName: device.name,
    detectionMethod: "camera",
    message: "ONVIF event (motion) received",
  });

  // Xử lý detection — async nếu có Redis, sync nếu không
  await addDetectJob({
    action: "camera-motion",
    source: "camera",
    deviceId,
    deviceName: device.name,
    trigger: "onvif_motion",
    triggerTimestamp: new Date().toISOString(),
    detectionMethod: "camera",
  });

  console.log(`[ONVIF] Motion event queued for detection: ${device.name}`);
}
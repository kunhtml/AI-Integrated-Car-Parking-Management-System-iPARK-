import { Request, Response } from "express";
import { Device } from "../models/Device.js";

export async function onvifMotionEventHandler(request: Request, response: Response) {
  const deviceId = request.params.id;
  const body = request.body;

  const device = await Device.findById(deviceId);
  if (!device) {
    return response.status(404).json({ message: "Không tìm thấy thiết bị." });
  }

  // ONVIF MotionAlarm event received
  try {
    const { safeCreateRecognitionLog } = await import("../services/recognitionLog.service.js");
    await safeCreateRecognitionLog({
      action: "camera-motion" as any,
      source: "camera",
      status: "pending" as any,
      detectedPlate: body.plate || "",
      confidence: body.confidence,
      rawText: body.rawText,
      imageHash: body.imageHash,
      imageUrl: body.imageUrl,
      vehicleType: body.vehicleType,
      detectionMethod: body.detectionMethod || "camera",
      sessionId: body.sessionId,
      deviceId: device._id,
      deviceName: device.name,
      matched: body.matched,
      matchStatus: body.matchStatus,
      vehicleMatchScore: body.vehicleMatchScore,
      message: body.message || "ONVIF MotionAlarm event received",
      createdBy: body.createdBy,
    });
  } catch (error) {
    console.error("[ONVIF Motion] Failed to create recognition log:", error);
  }

  // Trigger async detection if we have plate info
  if (body.plate) {
    try {
      const { safeCreateRecognitionLog } = await import("../services/recognitionLog.service.js");
      await safeCreateRecognitionLog({
        action: "camera-motion" as any,
        source: "camera",
        status: "success",
        plate: body.plate,
        detectedPlate: body.plate,
        confidence: body.confidence,
        rawText: body.rawText,
        imageHash: body.imageHash,
        imageUrl: body.imageUrl,
        vehicleType: body.vehicleType,
        detectionMethod: body.detectionMethod || "camera",
        sessionId: body.sessionId,
        deviceId: device._id,
        deviceName: device.name,
        matched: body.matched,
        matchStatus: body.matchStatus,
        vehicleMatchScore: body.vehicleMatchScore,
        message: "ONVIF MotionAlarm event received",
        createdBy: request.user?.id,
      });
    } catch (error) {
      console.error("[ONVIF] Failed to create recognition log:", error);
    }
  }

  response.json({ ok: true, message: "ONVIF motion event received" });
}

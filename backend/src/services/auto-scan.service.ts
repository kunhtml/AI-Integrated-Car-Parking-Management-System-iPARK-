import { Device, DeviceDocument } from "../models/Device.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { Vehicle } from "../models/Vehicle.js";
import { allocateSlot, occupySlot } from "./parkingSlot.service.js";
import { classifyVehicleByPlate } from "./parkingQuota.service.js";
import { detectVehicleImage } from "./ai.service.js";
import { captureDeviceSnapshot } from "./device.service.js";
import { createNotification } from "./notification.service.js";
import { safeCreateRecognitionLog } from "./recognitionLog.service.js";
import { objectId } from "./transaction.service.js";

/**
 * Auto-scan service: tự động chụp ảnh từ camera cổng vào,
 * OCR nhận diện biển số, và tạo phiên đỗ xe tự động.
 *
 * Deduplication: cùng biển số trong vòng autoScanDedupMinutes sẽ bị bỏ qua.
 */

const autoScanDedupMinutes = 5;

// Map<deviceId, NodeJS.Timeout> — lưu interval đang chạy
const activeIntervals = new Map<string, NodeJS.Timeout>();

// Map<deviceId, Date> — thời gian phát hiện biển số gần nhất (dedup)
const lastDetected = new Map<string, Date>();

async function ownerFromPlate(plate: string) {
  const vehicle = await Vehicle.findOne({ plate: plate.toUpperCase() });
  return vehicle?.userId;
}

async function scanOnce(device: DeviceDocument): Promise<void> {
  try {
    // 1. Chụp ảnh từ camera
    const snapshot = await captureDeviceSnapshot(device);

    // Cập nhật trạng thái device
    device.status = "online";
    device.lastSnapshotUrl = snapshot.imageUrl;
    device.lastSnapshotAt = new Date();
    await Device.findByIdAndUpdate(device._id, {
      $set: { status: device.status, lastSnapshotUrl: device.lastSnapshotUrl, lastSnapshotAt: device.lastSnapshotAt },
    });

    // 2. OCR nhận diện biển số
    const detection = await detectVehicleImage(
      {
        buffer: snapshot.buffer,
        mimetype: snapshot.mimetype,
        originalname: "auto-scan.jpg",
      } as Express.Multer.File,
    );

    if (!detection.plate) {
      // Không nhận diện được → bỏ qua, không log để tránh spam
      return;
    }

    // 3. Deduplication: cùng biển số trong vòng N phút → bỏ qua
    const dedupKey = `${device._id.toString()}:${detection.plate}`;
    const lastTime = lastDetected.get(dedupKey);
    if (lastTime) {
      const diffMinutes = (Date.now() - lastTime.getTime()) / (1000 * 60);
      if (diffMinutes < autoScanDedupMinutes) {
        return; // Đã phát hiện gần đây, bỏ qua
      }
    }
    lastDetected.set(dedupKey, new Date());

    // 4. Phân loại quota theo subscription active và cấp slot đúng pool.
    const quotaAccess = await classifyVehicleByPlate(detection.plate);
    const isMember = quotaAccess.customerType === "member";
    const slotDoc = await allocateSlot("Ô tô", undefined, { quotaType: quotaAccess.quotaType });
    if (!slotDoc) {
      await safeCreateRecognitionLog({
        action: "camera-entry", source: "camera", status: "failed",
        detectedPlate: detection.plate, confidence: detection.confidence,
        rawText: detection.rawText, imageHash: detection.imageHash,
        detectionMethod: "ocr", imageUrl: snapshot.imageUrl,
        deviceId: device._id, deviceName: device.name,
        message: "Auto-scan: không còn slot phù hợp với quota."
      });
      return;
    }

    // 5. Tạo phiên đỗ xe tự động
    const session = await ParkingSession.create({
      plate: detection.plate,
      ownerName: isMember ? "Thành viên" : "Khách vãng lai",
      vehicleType: "Ô tô",
      slot: slotDoc.slotCode,
       slotId: slotDoc._id,
       customerType: quotaAccess.customerType,
       quotaType: quotaAccess.quotaType,
      entryImageUrl: snapshot.imageUrl,
      entryDetectedPlate: detection.plate,
      entryConfidence: detection.confidence,
      entryImageHash: detection.imageHash,
      aiRawText: detection.rawText,
      ownerUserId: await ownerFromPlate(detection.plate),
      ...(quotaAccess.customerType === "member"
        ? { paymentStatus: "fully_paid", paymentMethod: "subscription", fee: 0, paidAmount: 0 }
        : {}),
      entryGate: device.name,
    });

    await occupySlot(slotDoc._id, session._id);

    // 6. Log nhận diện
    await safeCreateRecognitionLog({
      action: "camera-entry",
      source: "camera",
      status: "success",
      plate: session.plate,
      detectedPlate: detection.plate,
      confidence: detection.confidence,
      rawText: detection.rawText,
      imageHash: detection.imageHash,
      detectionMethod: "ocr",
      imageUrl: snapshot.imageUrl,
      vehicleType: session.vehicleType,
      sessionId: session._id,
      deviceId: device._id,
      deviceName: device.name,
      matched: true,
      matchStatus: session.matchStatus,
      message: `Auto-scan: Đã nhận diện biển số ${detection.plate} và tạo phiên tự động.`,
    });

    // 7. Thông báo cho admin/staff
    await createNotification({
      title: "Xe vào tự động (Auto-scan)",
      content: `Biển số ${detection.plate} đã được nhận diện tự động bởi camera "${device.name}". Slot: ${session.slot}.`,
      targetRole: "staff",
    });

    console.log(
      `[auto-scan] Device "${device.name}" detected plate ${detection.plate} → session ${session._id} slot ${session.slot}`,
    );
  } catch (error) {
    console.error(`[auto-scan] Error scanning device "${device.name}":`, error);
  }
}

function startDeviceScan(device: DeviceDocument): void {
  const deviceId = device._id.toString();
  if (activeIntervals.has(deviceId)) {
    return; // Đang chạy rồi
  }

  const intervalMs = (device.autoScanIntervalSeconds || 10) * 1000;
  console.log(
    `[auto-scan] Starting auto-scan for "${device.name}" every ${device.autoScanIntervalSeconds || 10}s`,
  );

  const timer = setInterval(() => {
    scanOnce(device);
  }, intervalMs);

  activeIntervals.set(deviceId, timer);

  // Chạy lần đầu ngay lập tức
  scanOnce(device);
}

function stopDeviceScan(deviceId: string): void {
  const timer = activeIntervals.get(deviceId);
  if (timer) {
    clearInterval(timer);
    activeIntervals.delete(deviceId);
    console.log(`[auto-scan] Stopped auto-scan for device ${deviceId}`);
  }
}

/**
 * Khởi động auto-scan cho tất cả entry device có autoScanEnabled = true
 * Gọi khi server boot.
 */
export async function initAutoScan(): Promise<void> {
  try {
    const devices = await Device.find({ gate: "entry", autoScanEnabled: true });
    for (const device of devices) {
      startDeviceScan(device);
    }
    if (devices.length > 0) {
      console.log(`[auto-scan] Initialized ${devices.length} entry device(s) for auto-scan`);
    }
  } catch (error) {
    console.error("[auto-scan] Error initializing auto-scan:", error);
  }
}

/**
 * Bật/tắt auto-scan cho một device
 */
export async function toggleAutoScan(
  deviceId: string,
  enabled: boolean,
): Promise<{ device: DeviceDocument; autoScanEnabled: boolean }> {
  const device = await Device.findById(deviceId);
  if (!device) {
    throw new Error("Không tìm thấy thiết bị.");
  }
  if (device.gate !== "entry") {
    throw new Error("Auto-scan chỉ khả dụng cho camera cổng vào.");
  }

  device.autoScanEnabled = enabled;
  await device.save();

  if (enabled) {
    startDeviceScan(device);
  } else {
    stopDeviceScan(device._id.toString());
  }

  return { device, autoScanEnabled: enabled };
}

/**
 * Cập nhật interval cho device đang auto-scan
 */
export async function updateAutoScanInterval(
  deviceId: string,
  intervalSeconds: number,
): Promise<void> {
  const device = await Device.findById(deviceId);
  if (!device) {
    throw new Error("Không tìm thấy thiết bị.");
  }

  device.autoScanIntervalSeconds = intervalSeconds;
  await device.save();

  // Restart interval nếu đang chạy
  if (device.autoScanEnabled) {
    stopDeviceScan(device._id.toString());
    startDeviceScan(device);
  }
}

/**
 * Lấy trạng thái auto-scan hiện tại
 */
export function getAutoScanStatus(): { deviceId: string; active: boolean }[] {
  const result: { deviceId: string; active: boolean }[] = [];
  activeIntervals.forEach((_, deviceId) => {
    result.push({ deviceId, active: true });
  });
  return result;
}

/**
 * Dừng tất cả auto-scan (gọi khi server shutdown)
 */
export function stopAllAutoScan(): void {
  activeIntervals.forEach((timer, deviceId) => {
    clearInterval(timer);
  });
  activeIntervals.clear();
  console.log("[auto-scan] Stopped all auto-scan intervals");
}

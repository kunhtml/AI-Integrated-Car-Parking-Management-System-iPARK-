import { Request, Response } from "express";
import { z } from "zod";
import { allocateCarSlot, canEnterParking, parkingConfig } from "../config/parking.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { Vehicle } from "../models/Vehicle.js";
import { createNotification } from "../services/notification.service.js";
import { safeCreateRecognitionLog } from "../services/recognitionLog.service.js";
import { serializeParkingSession, serializeVehicle } from "../utils/serializers.js";
import { objectId } from "../services/transaction.service.js";

const assistedBodySchema = z.object({
  plate: z.string().min(5, "Biển số phải có ít nhất 5 ký tự."),
  ownerName: z.string().min(2, "Tên chủ xe phải có ít nhất 2 ký tự."),
  ownerPhone: z.string().optional(),
  vehicleType: z.literal("Ô tô").default("Ô tô"),
  notes: z.string().optional(),
});

/**
 * UC60 / UC63 - Staff tạo phiên gửi xe thay cho khách hàng
 * (Ví dụ: người lớn tuổi tại quầy lễ tân)
 */
export async function assistedRegisterSession(request: Request, response: Response) {
  const body = assistedBodySchema.parse(request.body);
  const plate = body.plate.toUpperCase().trim();

  // Kiểm tra xe nằm trong danh sách cấm (UC56)
  const existingVehicle = await Vehicle.findOne({ plate });
  if (existingVehicle && existingVehicle.status === "Blacklist") {
    response.status(403).json({
      message: `Xe biển số ${plate} nằm trong danh sách cấm.`,
      reason: "blacklist",
    });
    return;
  }

  // Kiểm tra xe đã có phiên đang gửi (UC42)
  const duplicateSession = await ParkingSession.findOne({
    plate,
    status: "Đang gửi",
  });
  if (duplicateSession) {
    response.status(409).json({
      message: `Xe biển số ${plate} đã có phiên gửi xe đang hoạt động.`,
      existingSession: serializeParkingSession(duplicateSession),
    });
    return;
  }

  // Tạo hoặc tìm xe đã đăng ký
  let vehicle = existingVehicle;
  if (!vehicle) {
    vehicle = await Vehicle.create({
      plate,
      ownerName: body.ownerName,
      ownerPhone: body.ownerPhone,
      vehicleType: body.vehicleType,
      // Staff đăng ký → auto-approve
      status: "Đã đăng ký",
    });
  }

  // Kiểm tra sức chứa bãi xe
  const activeCount = await ParkingSession.countDocuments({ status: "Đang gửi" });
  const isMember = !!vehicle.userId;
  const check = await canEnterParking(isMember, activeCount);

  if (!check.allowed) {
    response.status(409).json({
      message: check.reason || "Bãi xe đã đầy.",
      remaining: parkingConfig.totalCapacity - activeCount,
      isMemberOnly: check.mode === "dynamic" && !isMember,
    });
    return;
  }

  // Tạo phiên gửi xe
  const session = await ParkingSession.create({
    plate,
    ownerName: body.ownerName,
    vehicleType: body.vehicleType,
    slot: allocateCarSlot(activeCount),
    ownerUserId: vehicle.userId,
    createdBy: objectId(request.user?.id),
    priorityType: isMember ? "member" : "walkin",
  });

  // Ghi log nhận diện
  await safeCreateRecognitionLog({
    action: "manual",
    source: "upload",
    status: "success",
    plate,
    vehicleType: body.vehicleType,
    sessionId: session._id,
    detectionMethod: "manual",
    message: `Nhân viên tạo phiên gửi xe thay khách hàng${body.notes ? `: ${body.notes}` : "."}`,
    createdBy: request.user?.id,
  });

  // Gửi thông báo cho admin
  await createNotification({
    title: "Phiên gửi xe tạo tại quầy",
    content: `Nhân viên ${request.user?.email || request.user?.id} đã tạo phiên gửi xe cho ${plate} (${body.ownerName})${body.notes ? ` - ${body.notes}` : ""}.`,
    targetRole: "admin",
    relatedSessionId: session._id.toString(),
  });

  response.status(201).json({ session: serializeParkingSession(session) });
}

/**
 * UC60 / UC63 - Staff đăng ký phương tiện thay cho khách hàng
 * Xe được auto-approve ("Đã đăng ký") vì do nhân viên đăng ký trực tiếp
 */
export async function assistedRegisterVehicle(request: Request, response: Response) {
  const body = assistedBodySchema.parse(request.body);
  const plate = body.plate.toUpperCase().trim();

  // Kiểm tra xe đã tồn tại
  const existing = await Vehicle.findOne({ plate });
  if (existing) {
    response.status(409).json({
      message: `Xe biển số ${plate} đã tồn tại trong hệ thống.`,
      vehicle: serializeVehicle(existing),
    });
    return;
  }

  const vehicle = await Vehicle.create({
    plate,
    ownerName: body.ownerName,
    ownerPhone: body.ownerPhone,
    vehicleType: body.vehicleType,
    // Staff đăng ký → auto-approve
    status: "Đã đăng ký",
  });

  await safeCreateRecognitionLog({
    action: "manual",
    source: "upload",
    status: "success",
    plate,
    vehicleType: body.vehicleType,
    detectionMethod: "manual",
    message: `Nhân viên đăng ký xe thay khách hàng: ${body.ownerName}${body.notes ? ` - ${body.notes}` : ""}`,
    createdBy: request.user?.id,
  });

  response.status(201).json({ vehicle: serializeVehicle(vehicle) });
}

import { RfidCard } from "../models/RfidCard.js";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ParkingSession } from "../models/ParkingSession.js";
import { Vehicle } from "../models/Vehicle.js";
import { VehicleRequest } from "../models/VehicleRequest.js";
import { serializeVehicle } from "../utils/serializers.js";

type PopulatedUser = {
  name?: string;
  email?: string;
  phone?: string | null;
} | null;
const USER_POPULATE_SELECT = "name email phone";

export async function listVehicles(_request: Request, response: Response) {
  const criteria =
    _request.user?.role === "customer" ? { userId: _request.user.id } : {};
  const vehicles = await Vehicle.find(criteria)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate({
      path: "userId",
      model: "User" as const,
      select: USER_POPULATE_SELECT,
    });

  const vehicleIds = vehicles.map((v) => v._id);
  const plates = vehicles.map((v) => v.plate).filter(Boolean);

  // Tìm các thẻ RFID đang liên kết theo vehicleId hoặc plate
  const rfidCards = await RfidCard.find({
    $or: [
      { vehicleId: { $in: vehicleIds } },
      { plate: { $in: plates } },
    ],
  }).lean();

  const rfidMap = new Map<string, any>();
  for (const card of rfidCards) {
    if (card.vehicleId) {
      rfidMap.set(card.vehicleId.toString(), card);
    }
    if (card.plate) {
      rfidMap.set(card.plate.toUpperCase(), card);
    }
  }

  response.json({
    vehicles: vehicles.map((v) => {
      const card = rfidMap.get(v._id.toString()) || rfidMap.get(v.plate.toUpperCase()) || null;
      return serializeVehicle(v, v.userId as unknown as PopulatedUser, card);
    }),
  });
}

export async function getVehicle(request: Request, response: Response) {
  const vehicle = await Vehicle.findById(request.params.id).populate({
    path: "userId",
    model: "User" as const,
    select: "name email phone createdAt",
  });
  if (!vehicle) {
    response.status(404).json({ message: "Không tìm thấy phương tiện." });
    return;
  }
  if (request.user?.role === "customer" && vehicle.userId?._id?.toString() !== request.user.id) {
    response.status(404).json({ message: "Không tìm thấy phương tiện." });
    return;
  }
  const rfidCard = await RfidCard.findOne({
    $or: [
      { vehicleId: vehicle._id },
      { plate: vehicle.plate },
    ],
  }).lean();

  response.json({
    vehicle: serializeVehicle(
      vehicle,
      vehicle.userId as unknown as PopulatedUser,
      rfidCard,
    ),
  });
}

export async function createVehicle(request: Request, response: Response) {
  if (request.user?.role !== "customer") {
    response.status(403).json({ message: "Chỉ khách hàng mới được đăng ký phương tiện." });
    return;
  }
  const body = z
    .object({
      plate: z.string().min(5),
      ownerName: z.string().optional(),
      ownerPhone: z.string().optional(),
      ownerAddress: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      color: z.string().optional(),
      year: z.coerce.number().int().min(1900).max(2100).optional(),
      engineNo: z.string().optional(),
      chassisNo: z.string().optional(),
      imageUrl: z.string().optional(),
    })
    .parse(request.body);

  const normPlate = body.plate
    .trim()
    .toUpperCase()
    .replace(/[\s.-]+/g, "");
  const existing = await Vehicle.findOne({ plate: normPlate });
  if (existing) {
    response
      .status(409)
      .json({ message: "Biển số đã tồn tại trong hệ thống." });
    return;
  }

  const vehicle = await Vehicle.create({
    plate: normPlate,
    ownerName: body.ownerName ?? "Chưa cập nhật",
    ownerPhone: body.ownerPhone,
    ownerAddress: body.ownerAddress,
    brand: body.brand,
    model: body.model,
    color: body.color,
    year: body.year,
    engineNo: body.engineNo,
    chassisNo: body.chassisNo,
    imageUrl: body.imageUrl,
    vehicleType: "Ô tô" as const,
    status: request.user?.role === "customer" ? "Cần duyệt" : "Đã đăng ký",
    userId: request.user?.id,
    isCompanyVehicle: false,
  });

  // Customer: tự tạo request duyệt để hiện trong tab "Yêu cầu"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vehicleRequest: any = null;
  if (request.user!.role === "customer") {
    vehicleRequest = await VehicleRequest.create({
      vehicleId: vehicle._id,
      userId: request.user!.id,
      type: "edit",
      requestedChanges: { status: "Đã đăng ký" },
    });
  }

  response.status(201).json({
    vehicle: serializeVehicle(vehicle),
    request: vehicleRequest
      ? {
          id: vehicleRequest._id.toString(),
          vehicleId: vehicle._id.toString(),
          subscriptionId: null,
          userId: request.user!.id,
          type: vehicleRequest.type,
          status: vehicleRequest.status,
          requestedChanges: vehicleRequest.requestedChanges,
          reason: undefined,
          adminNote: undefined,
          resolvedBy: undefined,
          resolvedAt: undefined,
          vehicle: serializeVehicle(vehicle),
          user: {
            name: request.user!.name,
            email: request.user!.email ?? null,
            phone: null,
          },
          createdAt: vehicleRequest.createdAt,
          updatedAt: vehicleRequest.updatedAt,
        }
      : null,
  });
}

export async function updateVehicle(request: Request, response: Response) {
  const body = z
    .object({
      id: z.string().min(1).optional(),
      plate: z.string().optional(),
      ownerName: z.string().optional(),
      ownerPhone: z.string().optional(),
      ownerAddress: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      color: z.string().optional(),
      year: z.coerce.number().int().min(1900).max(2100).optional(),
      engineNo: z.string().optional(),
      chassisNo: z.string().optional(),
      status: z.enum(["Đã đăng ký", "Cần duyệt", "Blacklist"]).optional(),
      rejectionReason: z.string().trim().max(500).optional(),
      imageUrl: z.string().optional(),
    })
    .parse(request.body);

  const vehicleId = body.id || request.params.id;
  const existing = await Vehicle.findById(vehicleId);
  if (!existing) {
    response.status(404).json({ message: "Không tìm thấy phương tiện." });
    return;
  }

  // Khách hàng chỉ được sửa thông tin xe của chính mình
  if (
    request.user?.role === "customer" &&
    existing.userId?.toString() !== request.user.id
  ) {
    response
      .status(403)
      .json({ message: "Bạn không có quyền sửa phương tiện này." });
    return;
  }

  let oldPlate: string | undefined;
  if (body.plate) {
    const normPlate = body.plate
      .trim()
      .toUpperCase()
      .replace(/[\s.-]+/g, "");
    const conflict = await Vehicle.findOne({ plate: normPlate });
    if (conflict && conflict._id.toString() !== vehicleId) {
      response
        .status(409)
        .json({ message: "Biển số đã tồn tại trong hệ thống." });
      return;
    }
    oldPlate = existing.plate;
    existing.plate = normPlate;
  }
  if (body.ownerName !== undefined) existing.ownerName = body.ownerName;
  if (body.ownerPhone !== undefined) existing.ownerPhone = body.ownerPhone;
  if (body.ownerAddress !== undefined)
    existing.ownerAddress = body.ownerAddress;
  if (body.brand !== undefined) existing.brand = body.brand;
  if (body.model !== undefined) existing.set("model", body.model);
  if (body.color !== undefined) existing.color = body.color;
  if (body.year !== undefined) existing.year = body.year;
  if (body.engineNo !== undefined) existing.engineNo = body.engineNo;
  if (body.chassisNo !== undefined) existing.chassisNo = body.chassisNo;
  if (request.user?.role !== "customer") {
    if (body.status !== undefined) {
      existing.status = body.status;
      if (body.status === "Đã đăng ký" || body.status === "Cần duyệt") {
        existing.rejectionReason = undefined;
      }
    }
    if (body.rejectionReason !== undefined)
      existing.rejectionReason = body.rejectionReason;
  }
  if (body.imageUrl !== undefined) existing.imageUrl = body.imageUrl;

  await existing.save();

  if (oldPlate && oldPlate !== existing.plate) {
    await RfidCard.updateMany(
      { $or: [{ vehicleId: existing._id }, { plate: oldPlate }] },
      { $set: { plate: existing.plate } },
    );
    await ParkingSession.updateMany(
      {
        status: "Đang gửi",
        $or: [{ vehicleId: existing._id }, { plate: oldPlate }],
      },
      { $set: { plate: existing.plate } },
    );
  }

  if (
    request.user?.role !== "customer" &&
    (body.status === "Đã đăng ký" ||
      body.status === "Blacklist" ||
      body.status === "Cần duyệt")
  ) {
    if (body.status === "Đã đăng ký") {
      await VehicleRequest.updateMany(
        { vehicleId: existing._id, status: { $in: ["pending", "rejected"] } },
        {
          $set: {
            status: "approved",
            resolvedBy: request.user?.id
              ? new mongoose.Types.ObjectId(request.user.id)
              : undefined,
            resolvedAt: new Date(),
            adminNote: "Admin đã duyệt xe.",
          },
        },
      );
    } else if (body.status === "Blacklist") {
      await VehicleRequest.updateMany(
        { vehicleId: existing._id, status: "pending" },
        {
          $set: {
            status: "rejected",
            resolvedBy: request.user?.id
              ? new mongoose.Types.ObjectId(request.user.id)
              : undefined,
            resolvedAt: new Date(),
            ...(body.rejectionReason
              ? { adminNote: body.rejectionReason }
              : { adminNote: "Xe bị từ chối." }),
          },
        },
      );
    } else if (body.status === "Cần duyệt") {
      await VehicleRequest.updateMany(
        { vehicleId: existing._id, status: { $in: ["approved", "rejected"] } },
        {
          $set: {
            status: "pending",
            adminNote: undefined,
            resolvedBy: undefined,
            resolvedAt: undefined,
          },
        },
      );
    }
  }

  const populated = await Vehicle.findById(existing._id).populate({
    path: "userId",
    model: "User" as const,
    select: USER_POPULATE_SELECT,
  });

  const rfidCard = await RfidCard.findOne({
    $or: [
      { vehicleId: existing._id },
      { plate: existing.plate },
    ],
  }).lean();

  response.json({
    vehicle: serializeVehicle(
      populated ?? existing,
      populated?.userId as unknown as PopulatedUser,
      rfidCard,
    ),
  });
}

export async function deleteVehicle(request: Request, response: Response) {
  const vehicle = await Vehicle.findById(request.params.id);
  if (!vehicle) {
    response.status(404).json({ message: "Không tìm thấy phương tiện." });
    return;
  }
  await Vehicle.findByIdAndDelete(request.params.id);
  response.json({ message: "Đã xóa phương tiện." });
}

// Customer gửi lại đơn đăng ký xe bị từ chối (Blacklist)
export async function resubmitVehicle(request: Request, response: Response) {
  const vehicle = await Vehicle.findById(request.params.id);
  if (!vehicle) {
    response.status(404).json({ message: "Không tìm thấy phương tiện." });
    return;
  }

  // Chỉ chủ xe mới được resubmit
  if (vehicle.userId?.toString() !== request.user?.id) {
    response
      .status(403)
      .json({ message: "Bạn không có quyền thực hiện thao tác này." });
    return;
  }

  // Chỉ cho phép resubmit khi xe đang bị từ chối
  if (vehicle.status !== "Blacklist") {
    response
      .status(409)
      .json({ message: "Chỉ có thể gửi lại đơn khi xe bị từ chối." });
    return;
  }

  // Hủy các pending request cũ (do admin reject xe trực tiếp mà không resolve request)
  await VehicleRequest.updateMany(
    { vehicleId: vehicle._id, status: "pending" },
    { $set: { status: "rejected", adminNote: "Tự động hủy khi gửi lại đơn." } },
  );

  const body = z
    .object({
      plate: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,9}$/).optional(),
      ownerName: z.string().optional(),
      ownerPhone: z.string().optional(),
      ownerAddress: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      color: z.string().optional(),
      year: z.coerce.number().int().min(1900).max(2100).optional(),
      engineNo: z.string().optional(),
      chassisNo: z.string().optional(),
      imageUrl: z.string().optional(),
    })
    .parse(request.body);

  // Cập nhật thông tin xe nếu customer có chỉnh sửa
  if (body.plate !== undefined && body.plate !== vehicle.plate) {
    const duplicate = await Vehicle.findOne({ plate: body.plate, _id: { $ne: vehicle._id } });
    if (duplicate) {
      response.status(409).json({ message: "Biển số này đã được đăng ký cho phương tiện khác." });
      return;
    }
    vehicle.plate = body.plate;
  }
  if (body.ownerName !== undefined) vehicle.ownerName = body.ownerName;
  if (body.ownerPhone !== undefined) vehicle.ownerPhone = body.ownerPhone;
  if (body.ownerAddress !== undefined) vehicle.ownerAddress = body.ownerAddress;
  if (body.brand !== undefined) vehicle.brand = body.brand;
  if (body.model !== undefined) vehicle.set("model", body.model);
  if (body.color !== undefined) vehicle.color = body.color;
  if (body.year !== undefined) vehicle.year = body.year;
  if (body.engineNo !== undefined) vehicle.engineNo = body.engineNo;
  if (body.chassisNo !== undefined) vehicle.chassisNo = body.chassisNo;
  if (body.imageUrl !== undefined) vehicle.imageUrl = body.imageUrl;

  // Reset trạng thái về chờ duyệt
  vehicle.status = "Cần duyệt";
  vehicle.rejectionReason = undefined;
  await vehicle.save();

  // Tạo lại VehicleRequest để admin xét duyệt
  const vehicleRequest = await VehicleRequest.create({
    vehicleId: vehicle._id,
    userId: request.user!.id,
    type: "edit",
    requestedChanges: { status: "Đã đăng ký" },
  });

  response.json({
    vehicle: serializeVehicle(vehicle),
    request: {
      id: vehicleRequest._id.toString(),
      vehicleId: vehicle._id.toString(),
      subscriptionId: null,
      userId: request.user!.id,
      type: vehicleRequest.type,
      status: vehicleRequest.status,
      requestedChanges: vehicleRequest.requestedChanges,
      reason: undefined,
      adminNote: undefined,
      resolvedBy: undefined,
      resolvedAt: undefined,
      vehicle: serializeVehicle(vehicle),
      user: {
        name: request.user!.name,
        email: request.user!.email ?? null,
        phone: null,
      },
      createdAt: vehicleRequest.createdAt,
      updatedAt: vehicleRequest.updatedAt,
    },
  });
}

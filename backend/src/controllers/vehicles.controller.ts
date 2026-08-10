import { Request, Response } from "express";
import { z } from "zod";
import { Vehicle } from "../models/Vehicle.js";
import { VehicleRequest } from "../models/VehicleRequest.js";
import { serializeVehicle } from "../utils/serializers.js";

type PopulatedUser = { name?: string; email?: string; phone?: string | null } | null;
const USER_POPULATE_SELECT = "name email phone";

export async function listVehicles(_request: Request, response: Response) {
  const criteria = _request.user?.role === "customer" ? { userId: _request.user.id } : {};
  const vehicles = await Vehicle.find(criteria)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate({ path: "userId", model: "User" as const, select: USER_POPULATE_SELECT });
  response.json({
    vehicles: vehicles.map((v) =>
      serializeVehicle(v, v.userId as unknown as PopulatedUser),
    ),
  });
}

export async function getVehicle(request: Request, response: Response) {
  const vehicle = await Vehicle.findById(request.params.id)
    .populate({ path: "userId", model: "User" as const, select: "name email phone createdAt" });
  if (!vehicle) {
    response.status(404).json({ message: "Không tìm thấy phương tiện." });
    return;
  }
  response.json({
    vehicle: serializeVehicle(vehicle, vehicle.userId as unknown as PopulatedUser),
  });
}

export async function createVehicle(request: Request, response: Response) {
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

  const normPlate = body.plate.trim().toUpperCase().replace(/[\s-]+/g, "");
  const existing = await Vehicle.findOne({ plate: normPlate });
  if (existing) {
    response.status(409).json({ message: "Biển số đã tồn tại trong hệ thống." });
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
    request:     vehicleRequest
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
          user: { name: request.user!.name, email: request.user!.email ?? null, phone: null },
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
      imageUrl: z.string().optional(),
    })
    .parse(request.body);

  const vehicleId = body.id || request.params.id;
  const existing = await Vehicle.findById(vehicleId);
  if (!existing) {
    response.status(404).json({ message: "Không tìm thấy phương tiện." });
    return;
  }

  if (body.plate) {
    const normPlate = body.plate.trim().toUpperCase().replace(/[\s-]+/g, "");
    const conflict = await Vehicle.findOne({ plate: normPlate });
    if (conflict && conflict._id.toString() !== vehicleId) {
      response.status(409).json({ message: "Biển số đã tồn tại trong hệ thống." });
      return;
    }
    existing.plate = normPlate;
  }
  if (body.ownerName !== undefined) existing.ownerName = body.ownerName;
  if (body.ownerPhone !== undefined) existing.ownerPhone = body.ownerPhone;
  if (body.ownerAddress !== undefined) existing.ownerAddress = body.ownerAddress;
  if (body.brand !== undefined) existing.brand = body.brand;
  if (body.model !== undefined) existing.set("model", body.model);
  if (body.color !== undefined) existing.color = body.color;
  if (body.year !== undefined) existing.year = body.year;
  if (body.engineNo !== undefined) existing.engineNo = body.engineNo;
  if (body.chassisNo !== undefined) existing.chassisNo = body.chassisNo;
  if (body.status !== undefined) existing.status = body.status;
  if (body.imageUrl !== undefined) existing.imageUrl = body.imageUrl;

  await existing.save();

  const populated = await Vehicle.findById(existing._id)
    .populate({ path: "userId", model: "User" as const, select: USER_POPULATE_SELECT });

  response.json({
    vehicle: serializeVehicle(populated ?? existing, populated?.userId as unknown as PopulatedUser),
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

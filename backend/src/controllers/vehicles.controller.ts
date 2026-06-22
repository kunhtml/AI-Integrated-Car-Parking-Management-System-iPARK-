import { Request, Response } from "express";
import { z } from "zod";
import { Vehicle } from "../models/Vehicle.js";
import { serializeVehicle } from "../utils/serializers.js";

export async function listVehicles(_request: Request, response: Response) {
  const criteria = _request.user?.role === "customer" ? { userId: _request.user.id } : {};
  const vehicles = await Vehicle.find(criteria).sort({ createdAt: -1 }).limit(100);
  response.json({ vehicles: vehicles.map(serializeVehicle) });
}

export async function createVehicle(request: Request, response: Response) {
  const body = z
    .object({
      plate: z.string().min(5),
      owner: z.string().min(2),
      vehicleType: z.literal("Ô tô").default("Ô tô"),
    })
    .parse(request.body);

  const vehicle = await Vehicle.create({
    plate: body.plate,
    ownerName: body.owner,
    vehicleType: "Ô tô",
    status: request.user?.role === "customer" ? "Cần duyệt" : "Đã đăng ký",
    userId: request.user?.id,
  });

  response.status(201).json({ vehicle: serializeVehicle(vehicle) });
}

export async function updateVehicle(request: Request, response: Response) {
  const body = z
    .object({
      id: z.string().min(1),
      status: z.enum(["Đã đăng ký", "Cần duyệt", "Blacklist"]),
    })
    .parse(request.body);

  const vehicle = await Vehicle.findByIdAndUpdate(body.id, { status: body.status }, { new: true });
  if (!vehicle) {
    response.status(404).json({ message: "Không tìm thấy phương tiện." });
    return;
  }

  response.json({ vehicle: serializeVehicle(vehicle) });
}

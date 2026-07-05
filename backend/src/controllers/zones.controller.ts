import { Request, Response } from "express";
import { z } from "zod";
import {
  createZone,
  deleteZone,
  getZoneById,
  listZones,
  updateZone,
} from "../services/zone.service.js";
import { serializeZone } from "../utils/serializers.js";

const zoneBodySchema = z.object({
  name: z
<<<<<<< HEAD
    .string()
    .min(1, "Tên khu vực là bắt buộc.")
    .max(50, "Tên khu vực không được dài quá 50 ký tự.")
    .trim()
    .refine((value) => value.length > 0, "Tên khu vực không được chỉ chứa khoảng trắng."),
  description: z.string().max(255, "Mô tả không được dài quá 255 ký tự.").optional(),
  capacity: z
    .number()
=======
    .string({ message: "Tên khu vực là bắt buộc." })
    .min(1, "Tên khu vực là bắt buộc.")
    .max(50, "Tên khu vực không được dài quá 50 ký tự.")
    .trim()
    .refine(
      (v) => v.length > 0,
      "Tên khu vực không được chỉ chứa khoảng trắng.",
    ),
  description: z
    .string()
    .max(255, "Mô tả không được dài quá 255 ký tự.")
    .optional(),
  capacity: z
    .number({ message: "Sức chứa là bắt buộc." })
>>>>>>> 49bfd09c69d8e4d4c7df76f95d064c30a0512d62
    .int("Sức chứa phải là số nguyên.")
    .min(1, "Sức chứa phải lớn hơn 0."),
  allowedVehicleTypes: z.array(z.string().min(1)).min(1, "Phải chọn ít nhất một loại xe."),
  displayOrder: z
    .number()
    .int("Thứ tự phải là số nguyên.")
    .min(0, "Thứ tự hiển thị không được là số âm.")
    .optional(),
});

export async function listZonesHandler(_request: Request, response: Response) {
  const rows = await listZones();
  response.json({
    zones: rows.map(({ zone, stats }) => serializeZone(zone, stats)),
  });
}

export async function getZoneHandler(request: Request, response: Response) {
  const zone = await getZoneById(String(request.params.id));
  response.json({ zone: serializeZone(zone) });
}

export async function createZoneHandler(request: Request, response: Response) {
  const body = zoneBodySchema.parse(request.body);
  const zone = await createZone(body);
  response.status(201).json({ zone: serializeZone(zone) });
}

export async function updateZoneHandler(request: Request, response: Response) {
  const body = zoneBodySchema.partial().parse(request.body);
  const zone = await updateZone(String(request.params.id), body);
  response.json({ zone: serializeZone(zone) });
}

export async function deleteZoneHandler(request: Request, response: Response) {
  await deleteZone(String(request.params.id));
  response.json({ ok: true, message: "Zone đã được vô hiệu hóa." });
}

import { Request, Response } from "express";
import { z } from "zod";
import { ParkingSlot } from "../models/ParkingSlot.js";
import {
  createZone,
  deleteZone,
  getZoneById,
  listZones,
  updateZone,
} from "../services/zone.service.js";
import { serializeZone } from "../utils/serializers.js";

const zoneBodySchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  capacity: z.number().int().min(1),
  walkInQuota: z.number().int().min(0).optional(),
  subscriberQuota: z.number().int().min(0).optional(),
  allowedVehicleTypes: z.array(z.string().min(1)).min(1),
  pricingConfigId: z.string().optional(),
  displayOrder: z.number().int().optional(),
});

export async function listZonesHandler(request: Request, response: Response) {
  const rows = await listZones();
  response.json({ zones: rows.map(({ zone, stats }) => serializeZone(zone, stats)) });
}

export async function getZoneHandler(request: Request, response: Response) {
  const zone = await getZoneById(String(request.params.id));
  const slotBreakdown = await ParkingSlot.aggregate<{ _id: string; count: number }>([
    { $match: { zoneId: zone._id } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const stats = { total: 0, empty: 0, occupied: 0, reserved: 0, maintenance: 0 };
  for (const row of slotBreakdown) {
    const key = row._id as keyof typeof stats;
    if (key in stats) stats[key] = row.count;
    stats.total += row.count;
  }

  response.json({ zone: serializeZone(zone, stats) });
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

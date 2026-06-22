import { Request, Response } from "express";
import { z } from "zod";
import { createZone, deleteZone, getZoneById, listZones, updateZone } from "../services/zone.service.js";
import { serializeZone } from "../utils/serializers.js";

const zoneBodySchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  capacity: z.number().int().min(1),
  allowedVehicleTypes: z.array(z.string().min(1)).min(1),
  displayOrder: z.number().int().optional(),
});

export async function listZonesHandler(_request: Request, response: Response) {
  const rows = await listZones();
  response.json({ zones: rows.map(({ zone, stats }) => serializeZone(zone, stats)) });
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

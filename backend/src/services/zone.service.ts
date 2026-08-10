import mongoose from "mongoose";
import { ParkingSlot } from "../models/ParkingSlot.js";
import { Zone, ZoneDocument } from "../models/Zone.js";

export type ZoneStats = {
  total: number;
  empty: number;
  occupied: number;
  reserved: number;
  maintenance: number;
};

export type ZoneWithStats = ZoneDocument & { stats: ZoneStats };

export async function listZones(): Promise<{ zone: ZoneDocument; stats: ZoneStats }[]> {
  const zones = await Zone.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });

  const zoneIds = zones.map((z) => z._id);

  // Aggregate slot stats for all zones in one query
  const statRows = await ParkingSlot.aggregate<{
    _id: { zoneId: mongoose.Types.ObjectId; status: string };
    count: number;
  }>([
    { $match: { zoneId: { $in: zoneIds } } },
    { $group: { _id: { zoneId: "$zoneId", status: "$status" }, count: { $sum: 1 } } },
  ]);

  // Build a map: zoneId → stats
  const statsMap = new Map<string, ZoneStats>();
  for (const row of statRows) {
    const key = row._id.zoneId.toString();
    if (!statsMap.has(key)) {
      statsMap.set(key, { total: 0, empty: 0, occupied: 0, reserved: 0, maintenance: 0 });
    }
    const entry = statsMap.get(key)!;
    entry.total += row.count;
    const status = row._id.status as keyof ZoneStats;
    if (status in entry) entry[status] += row.count;
  }

  return zones.map((zone) => ({
    zone,
    stats: statsMap.get(zone._id.toString()) ?? {
      total: 0,
      empty: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
    },
  }));
}

export async function getZoneById(id: string): Promise<ZoneDocument> {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Zone không tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  const zone = await Zone.findById(id);
  if (!zone) {
    const err = new Error("Zone không tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return zone;
}

export type CreateZoneData = {
  name: string;
  description?: string;
  capacity: number;
  walkInQuota?: number;
  subscriberQuota?: number;
  allowedVehicleTypes: string[];
  pricingConfigId?: string;
  displayOrder?: number;
};

export async function createZone(data: CreateZoneData): Promise<ZoneDocument> {
  const existed = await Zone.findOne({ name: data.name.trim() });
  if (existed) {
    const err = new Error(`Zone "${data.name}" đã tồn tại.`) as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const zone = await Zone.create({
    name: data.name.trim(),
    description: data.description,
    capacity: data.capacity,
    walkInQuota: data.walkInQuota ?? 0,
    subscriberQuota: data.subscriberQuota ?? 0,
    allowedVehicleTypes: data.allowedVehicleTypes,
    pricingConfigId:
      data.pricingConfigId && mongoose.isValidObjectId(data.pricingConfigId)
        ? new mongoose.Types.ObjectId(data.pricingConfigId)
        : undefined,
    displayOrder: data.displayOrder ?? 0,
    isActive: true,
  });
  return zone;
}

export type UpdateZoneData = Partial<CreateZoneData>;

export async function updateZone(id: string, data: UpdateZoneData): Promise<ZoneDocument> {
  const zone = await getZoneById(id);

  if (data.name && data.name.trim() !== zone.name) {
    const nameConflict = await Zone.findOne({
      name: data.name.trim(),
      _id: { $ne: zone._id },
    });
    if (nameConflict) {
      const err = new Error(`Zone "${data.name}" đã tồn tại.`) as Error & { status: number };
      err.status = 409;
      throw err;
    }
    await ParkingSlot.updateMany({ zoneId: zone._id }, { $set: { zoneName: data.name.trim() } });
  }

  const updateFields: Record<string, unknown> = {};
  if (data.name !== undefined) updateFields.name = data.name.trim();
  if (data.description !== undefined) updateFields.description = data.description;
  if (data.capacity !== undefined) updateFields.capacity = data.capacity;
  if (data.walkInQuota !== undefined) updateFields.walkInQuota = data.walkInQuota;
  if (data.subscriberQuota !== undefined) updateFields.subscriberQuota = data.subscriberQuota;
  if (data.allowedVehicleTypes !== undefined) updateFields.allowedVehicleTypes = data.allowedVehicleTypes;
  if (data.displayOrder !== undefined) updateFields.displayOrder = data.displayOrder;
  if (data.pricingConfigId !== undefined) {
    updateFields.pricingConfigId =
      data.pricingConfigId && mongoose.isValidObjectId(data.pricingConfigId)
        ? new mongoose.Types.ObjectId(data.pricingConfigId)
        : null;
  }

  const updated = await Zone.findByIdAndUpdate(id, { $set: updateFields }, { returnDocument: "after" });
  if (!updated) {
    const err = new Error("Zone không tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return updated;
}

export async function deleteZone(id: string): Promise<void> {
  const zone = await getZoneById(id);

  // Guard: block delete if any slot in zone is occupied or reserved
  const blockedCount = await ParkingSlot.countDocuments({
    zoneId: zone._id,
    status: { $in: ["occupied", "reserved"] },
  });
  if (blockedCount > 0) {
    const err = new Error(
      `Không thể xóa zone đang có ${blockedCount} vị trí đang sử dụng hoặc đặt trước.`,
    ) as Error & { status: number };
    err.status = 409;
    throw err;
  }

  zone.isActive = false;
  await Zone.findByIdAndUpdate(id, { $set: { isActive: false } });
}

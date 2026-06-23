import { Zone, ZoneDocument } from "../models/Zone.js";

export type ZoneStats = {
  total: number;
  empty: number;
  occupied: number;
};

export async function listZones(): Promise<
  { zone: ZoneDocument; stats: ZoneStats }[]
> {
  const zones = await Zone.find({ isActive: true }).sort({
    displayOrder: 1,
    name: 1,
  });
  return zones.map((zone) => ({
    zone,
    stats: { total: zone.capacity, empty: zone.capacity, occupied: 0 },
  }));
}

export async function getZoneById(id: string): Promise<ZoneDocument> {
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
  allowedVehicleTypes: string[];
  displayOrder?: number;
};

export async function createZone(data: CreateZoneData): Promise<ZoneDocument> {
  const existed = await Zone.findOne({ name: data.name.trim() });
  if (existed) {
    const err = new Error(`Zone "${data.name}" đã tồn tại.`) as Error & {
      status: number;
    };
    err.status = 409;
    throw err;
  }
  const zone = await Zone.create({
    name: data.name.trim(),
    description: data.description,
    capacity: data.capacity,
    allowedVehicleTypes: data.allowedVehicleTypes,
    displayOrder: data.displayOrder ?? 0,
    isActive: true,
  });
  return zone;
}

export type UpdateZoneData = Partial<CreateZoneData>;

export async function updateZone(
  id: string,
  data: UpdateZoneData,
): Promise<ZoneDocument> {
  const zone = await getZoneById(id);

  if (data.name && data.name.trim() !== zone.name) {
    const nameConflict = await Zone.findOne({
      name: data.name.trim(),
      _id: { $ne: zone._id },
    });
    if (nameConflict) {
      const err = new Error(`Zone "${data.name}" đã tồn tại.`) as Error & {
        status: number;
      };
      err.status = 409;
      throw err;
    }
  }

  const updateFields: Record<string, unknown> = {};
  if (data.name !== undefined) updateFields.name = data.name.trim();
  if (data.description !== undefined)
    updateFields.description = data.description;
  if (data.capacity !== undefined) updateFields.capacity = data.capacity;
  if (data.allowedVehicleTypes !== undefined)
    updateFields.allowedVehicleTypes = data.allowedVehicleTypes;
  if (data.displayOrder !== undefined)
    updateFields.displayOrder = data.displayOrder;

  const updated = await Zone.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { returnDocument: "after" },
  );
  if (!updated) {
    const err = new Error("Zone không tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return updated;
}

export async function deleteZone(id: string): Promise<void> {
  await getZoneById(id);
  await Zone.findByIdAndUpdate(id, { $set: { isActive: false } });
}

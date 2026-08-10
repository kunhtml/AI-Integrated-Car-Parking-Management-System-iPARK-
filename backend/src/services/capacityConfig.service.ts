import mongoose from "mongoose";
import { CapacityConfig } from "../models/CapacityConfig.js";
import { CapacityChangeLog } from "../models/CapacityChangeLog.js";
import { Zone } from "../models/Zone.js";

export const DEFAULT_GLOBAL_CAPACITY = 100;

export class CapacityConfigError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function getOrCreateGlobalConfig() {
  let cfg = await CapacityConfig.findOne({ key: "default" });
  if (!cfg) {
    cfg = await CapacityConfig.create({
      key: "default",
      globalCapacity: DEFAULT_GLOBAL_CAPACITY,
    });
  }
  return cfg;
}

export type ZoneCapacityInput = {
  capacity: number;
  walkInQuota: number;
  subscriberQuota: number;
};

export function validateZoneCapacity(input: ZoneCapacityInput, excludeZoneId?: string) {
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    throw new CapacityConfigError("Sức chứa zone phải là số nguyên ≥ 1.");
  }
  if (!Number.isInteger(input.walkInQuota) || input.walkInQuota < 0) {
    throw new CapacityConfigError("Walk-in quota phải là số nguyên ≥ 0.");
  }
  if (!Number.isInteger(input.subscriberQuota) || input.subscriberQuota < 0) {
    throw new CapacityConfigError("Subscriber quota phải là số nguyên ≥ 0.");
  }
  if (input.walkInQuota > input.capacity) {
    throw new CapacityConfigError("Walk-in quota không được vượt quá sức chứa zone.");
  }
  if (input.subscriberQuota > input.capacity) {
    throw new CapacityConfigError("Subscriber quota không được vượt quá sức chứa zone.");
  }
  if (input.walkInQuota + input.subscriberQuota > input.capacity) {
    throw new CapacityConfigError(
      "Tổng walk-in + subscriber quota không được vượt quá sức chứa zone.",
    );
  }
}

export async function computeActiveZoneCapacitySum(excludeZoneId?: string) {
  const filter: Record<string, unknown> = { isActive: true };
  if (excludeZoneId && mongoose.isValidObjectId(excludeZoneId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeZoneId) };
  }
  const zones = await Zone.find(filter).select("capacity").lean();
  return zones.reduce((sum, z) => sum + (z.capacity ?? 0), 0);
}

export async function updateGlobalCapacity(
  newCapacity: number,
  changedBy: string | undefined,
  reason?: string,
) {
  if (!Number.isInteger(newCapacity) || newCapacity < 1) {
    throw new CapacityConfigError("Tổng sức chứa phải là số nguyên ≥ 1.");
  }
  const before = await getOrCreateGlobalConfig();
  const otherZonesSum = await computeActiveZoneCapacitySum();
  if (otherZonesSum > newCapacity) {
    throw new CapacityConfigError(
      `Tổng capacity hiện tại của các zone (${otherZonesSum}) vượt quá tổng sức chứa mới (${newCapacity}). Hãy giảm capacity zone trước.`,
    );
  }
  const after = await CapacityConfig.findOneAndUpdate(
    { key: "default" },
    { $set: { globalCapacity: newCapacity, updatedBy: changedBy } },
    { returnDocument: "after", upsert: true },
  );
  await CapacityChangeLog.create({
    entityType: "global",
    before: { globalCapacity: before.globalCapacity },
    after: { globalCapacity: after.globalCapacity },
    changedBy: changedBy ? new mongoose.Types.ObjectId(changedBy) : undefined,
    reason,
  });
  return after;
}

export async function updateZoneCapacity(
  zoneId: string,
  input: ZoneCapacityInput,
  changedBy: string | undefined,
  reason?: string,
) {
  if (!mongoose.isValidObjectId(zoneId)) {
    throw new CapacityConfigError("Zone không tồn tại.", 404);
  }
  const zone = await Zone.findById(zoneId);
  if (!zone) {
    throw new CapacityConfigError("Zone không tồn tại.", 404);
  }
  validateZoneCapacity(input, zoneId);
  const global = await getOrCreateGlobalConfig();
  const otherZonesSum = await computeActiveZoneCapacitySum(zoneId);
  const totalAfter = otherZonesSum + input.capacity;
  if (totalAfter > global.globalCapacity) {
    throw new CapacityConfigError(
      `Tổng capacity các zone (${totalAfter}) sẽ vượt tổng sức chứa (${global.globalCapacity}).`,
    );
  }
  const before = {
    capacity: zone.capacity,
    walkInQuota: zone.walkInQuota,
    subscriberQuota: zone.subscriberQuota,
  };
  zone.capacity = input.capacity;
  zone.walkInQuota = input.walkInQuota;
  zone.subscriberQuota = input.subscriberQuota;
  await zone.save();
  await CapacityChangeLog.create({
    entityType: "zone",
    zoneId: zone._id,
    before,
    after: {
      capacity: zone.capacity,
      walkInQuota: zone.walkInQuota,
      subscriberQuota: zone.subscriberQuota,
    },
    changedBy: changedBy ? new mongoose.Types.ObjectId(changedBy) : undefined,
    reason,
  });
  return zone;
}

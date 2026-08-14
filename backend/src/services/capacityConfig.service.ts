import mongoose from "mongoose";
import { CapacityConfig } from "../models/CapacityConfig.js";
import { CapacityChangeLog } from "../models/CapacityChangeLog.js";
import { Zone } from "../models/Zone.js";
import { ParkingSlot } from "../models/ParkingSlot.js";

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

async function alignDefaultZoneCapacity(targetCapacity: number) {
  const totalZoneCapacity = await computeActiveZoneCapacitySum();
  const defaultZone = await Zone.findOne({ name: "Bãi chung", isActive: true });
  if (!defaultZone) {
    if (totalZoneCapacity > targetCapacity) {
      throw new CapacityConfigError(
        `Tổng capacity các zone (${totalZoneCapacity}) vượt quá tổng sức chứa mới (${targetCapacity}). Hãy giảm capacity zone trước.`,
      );
    }
    return;
  }

  const otherZonesCapacity = totalZoneCapacity - defaultZone.capacity;
  const nextZoneCapacity = targetCapacity - otherZonesCapacity;
  if (nextZoneCapacity < 1) {
    throw new CapacityConfigError(
      `Tổng capacity của các zone khác (${otherZonesCapacity}) vượt quá tổng sức chứa mới (${targetCapacity}).`,
    );
  }

  const subscriberQuota = Math.min(defaultZone.subscriberQuota, nextZoneCapacity);
  const walkInQuota = nextZoneCapacity - subscriberQuota;
  defaultZone.capacity = nextZoneCapacity;
  defaultZone.subscriberQuota = subscriberQuota;
  defaultZone.walkInQuota = walkInQuota;
  await defaultZone.save();
}

async function syncSlotsToGlobalCapacity(targetCapacity: number) {
  const existingSlots = await ParkingSlot.find()
    .select("_id slotCode status")
    .sort({ createdAt: -1 })
    .lean();

  if (existingSlots.length > targetCapacity) {
    const slotsToRemove = existingSlots.length - targetCapacity;
    const removableSlots = existingSlots
      .filter((slot) => slot.status === "empty" || slot.status === "maintenance")
      .slice(0, slotsToRemove);
    if (removableSlots.length < slotsToRemove) {
      throw new CapacityConfigError(
        `Không thể giảm xuống ${targetCapacity} slot vì còn ${slotsToRemove - removableSlots.length} slot đang sử dụng hoặc được giữ chỗ.`,
        409,
      );
    }

    await ParkingSlot.deleteMany({ _id: { $in: removableSlots.map((slot) => slot._id) } });
    return -removableSlots.length;
  }

  const slotsToCreate = targetCapacity - existingSlots.length;
  if (slotsToCreate === 0) return 0;

  let zone = await Zone.findOne({ isActive: true })
    .sort({ displayOrder: 1, name: 1 });
  if (!zone) {
    zone = await Zone.create({
      name: "Bãi chung",
      description: "Khu mặc định cho các slot tự động tạo theo tổng sức chứa.",
      capacity: targetCapacity,
      walkInQuota: targetCapacity,
      subscriberQuota: 0,
      allowedVehicleTypes: ["Ô tô"],
      displayOrder: 999,
      isActive: true,
    });
  }

  const usedCodes = new Set(existingSlots.map((slot) => slot.slotCode.toUpperCase()));
  const slots = [];
  let number = 1;
  while (slots.length < slotsToCreate) {
    const slotCode = String(number++);
    if (usedCodes.has(slotCode)) continue;
    usedCodes.add(slotCode);
    slots.push({
      slotCode,
      zoneId: zone._id,
      zoneName: zone.name,
      slotType: "regular" as const,
      features: [],
      floor: 0,
      accessPolicy: "guest" as const,
      quotaType: "walk_in" as const,
      status: "empty" as const,
    });
  }

  await ParkingSlot.insertMany(slots);
  return slots.length;
}

export async function updateGlobalCapacity(
  newCapacity: number,
  changedBy: string | undefined,
  reason?: string,
) {
  if (!Number.isInteger(newCapacity) || newCapacity < 1) {
    throw new CapacityConfigError("Tổng sức chứa phải là số nguyên ≥ 1.");
  }

  const activeSlotCount = await ParkingSlot.countDocuments({
    status: { $in: ["occupied", "reserved"] },
  });
  if (newCapacity < activeSlotCount) {
    throw new CapacityConfigError(
      `Không thể giảm xuống ${newCapacity} slot vì đang có ${activeSlotCount} slot có xe hoặc được giữ chỗ. Sức chứa tối thiểu là ${activeSlotCount}.`,
      409,
    );
  }

  const before = await getOrCreateGlobalConfig();
  await alignDefaultZoneCapacity(newCapacity);
  const totalZoneCapacity = await computeActiveZoneCapacitySum();
  if (totalZoneCapacity > newCapacity) {
    throw new CapacityConfigError(
      `Tổng capacity hiện tại của các zone (${totalZoneCapacity}) vượt quá tổng sức chứa mới (${newCapacity}). Hãy giảm capacity zone trước.`,
    );
  }

  await syncSlotsToGlobalCapacity(newCapacity);
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

export async function assertSlotCreationCapacity(additionalSlots = 1) {
  if (!Number.isInteger(additionalSlots) || additionalSlots < 1) {
    throw new CapacityConfigError("S\u1ed1 slot c\u1ea7n t\u1ea1o ph\u1ea3i l\u00e0 s\u1ed1 nguy\u00ean d\u01b0\u01a1ng.");
  }
  const config = await getOrCreateGlobalConfig();
  const currentSlots = await ParkingSlot.countDocuments();
  if (currentSlots + additionalSlots > config.globalCapacity) {
    throw new CapacityConfigError(
      "Kh\u00f4ng th\u1ec3 t\u1ea1o th\u00eam slot: \u0111\u00e3 c\u00f3 " + currentSlots + "/" + config.globalCapacity + " slot; t\u1ed5ng s\u1ee9c ch\u1ee9a l\u00e0 " + config.globalCapacity + ".",
      409,
    );
  }
}

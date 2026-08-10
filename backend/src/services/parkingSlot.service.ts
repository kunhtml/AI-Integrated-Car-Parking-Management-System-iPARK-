import mongoose from "mongoose";
import { ParkingSlot, ParkingSlotDocument, SlotAccessPolicy, SlotType } from "../models/ParkingSlot.js";
import { Zone } from "../models/Zone.js";

export type ZoneWithSlots = {
  zoneId: string;
  zoneName: string;
  slots: ParkingSlotDocument[];
};

/**
 * Atomically find and lock an empty slot suitable for the given vehicle type.
 * Optionally prefer a specific zone first, then fall back to any available zone.
 *
 * Quy tắc ưu tiên theo accessPolicy:
 * - Subscriber (cư dân): resident → shared → guest
 * - Guest (khách vãng lai): guest → shared  (KHÔNG vào resident)
 *
 * Returns null if no slot is available (parking full).
 */
export async function allocateSlot(
  vehicleType: string,
  preferredZoneId?: string,
  options: { isSubscriber?: boolean } = {},
): Promise<ParkingSlotDocument | null> {
  const isSubscriber = options.isSubscriber === true;

  // Build list of zone ids whose allowedVehicleTypes includes vehicleType
  const zones = await Zone.find({
    isActive: true,
    allowedVehicleTypes: vehicleType,
  }).sort({ displayOrder: 1, name: 1 });

  if (zones.length === 0) return null;

  // Put preferred zone first
  let orderedZones = zones;
  if (preferredZoneId && mongoose.isValidObjectId(preferredZoneId)) {
    const preferred = zones.find((z) => z._id.toString() === preferredZoneId);
    if (preferred) {
      orderedZones = [preferred, ...zones.filter((z) => z._id.toString() !== preferredZoneId)];
    }
  }

  // Thứ tự ưu tiên accessPolicy
  const priority: SlotAccessPolicy[] = isSubscriber
    ? ["resident", "shared", "guest"]
    : ["guest", "shared"];

  // Sắp xếp theo slotCode tăng dần, có xử lý số để A-2 < A-10
  const slotSort = { slotCode: 1 } as const;
  const slotCollation = { locale: "en", numericOrdering: true } as const;

  console.log(
    `[allocateSlot] vehicleType=${vehicleType} isSubscriber=${isSubscriber} candidateZones=${orderedZones.length}`,
  );

  for (const accessPolicy of priority) {
    for (const zone of orderedZones) {
      // Atomic findOneAndUpdate để tránh race condition; lọc thêm accessPolicy
      const slot = await ParkingSlot.findOneAndUpdate(
        { zoneId: zone._id, status: "empty", accessPolicy },
        { $set: { status: "occupied" } },
        { returnDocument: "after", sort: slotSort, collation: slotCollation },
      );
      if (slot) {
        console.log(
          `[allocateSlot] ✅ Gán slotCode=${slot.slotCode} zone=${zone.name} policy=${accessPolicy}`,
        );
        return slot;
      }
    }
  }

  console.warn(
    `[allocateSlot] ❌ Hết chỗ trống. vehicleType=${vehicleType} isSubscriber=${isSubscriber}`,
  );
  return null;
}

/**
 * Mark slot as occupied by a session. Used after session is created.
 * Note: allocateSlot already sets status="occupied" atomically.
 * This function sets currentSessionId as a second atomic update.
 */
export async function occupySlot(
  slotId: mongoose.Types.ObjectId | string,
  sessionId: mongoose.Types.ObjectId | string,
): Promise<void> {
  await ParkingSlot.findByIdAndUpdate(slotId, {
    $set: {
      status: "occupied",
      currentSessionId: new mongoose.Types.ObjectId(sessionId.toString()),
    },
  });
}

/**
 * Release a slot back to empty after checkout.
 * Silently skips if slotId is null/undefined (backward compat with old sessions).
 */
export async function freeSlot(
  slotId?: mongoose.Types.ObjectId | string | null,
): Promise<void> {
  if (!slotId) return;
  await ParkingSlot.findByIdAndUpdate(slotId, {
    $set: { status: "empty" },
    $unset: { currentSessionId: "" },
  });
}

/**
 * Dọn các slot bị kẹt: đang "occupied" nhưng KHÔNG còn phiên "Đang gửi" nào chiếm.
 * Backstop cho trường hợp checkout lỗi giữa chừng khiến slot không được nhả.
 * KHÔNG đụng tới "reserved" (đặt trước) hay "maintenance".
 * Trả về số slot đã đưa về trống.
 */
export async function reconcileStaleSlots(): Promise<number> {
  const { ParkingSession } = await import("../models/ParkingSession.js");
  const busy = await ParkingSlot.find({ status: "occupied" });
  let freed = 0;
  for (const slot of busy) {
    const live = await ParkingSession.findOne({ slotId: slot._id, status: "Đang gửi" });
    if (!live) {
      slot.status = "empty";
      slot.currentSessionId = undefined;
      await slot.save();
      freed++;
    }
  }
  return freed;
}

/**
 * Return full slot map grouped by zone for realtime dashboard.
 */
export async function getSlotMap(): Promise<ZoneWithSlots[]> {
  const [zones, slots] = await Promise.all([
    Zone.find({ isActive: true }).sort({ displayOrder: 1, name: 1 }),
    ParkingSlot.find().sort({ slotCode: 1 }),
  ]);

  return zones.map((zone) => ({
    zoneId: zone._id.toString(),
    zoneName: zone.name,
    slots: slots.filter((s) => s.zoneId.toString() === zone._id.toString()),
  }));
}

/**
 * Bulk create slots for a zone with auto-generated slot codes.
 */
export async function bulkCreateSlots(params: {
  zoneId: string;
  count: number;
  slotType?: SlotType;
  features?: string[];
  floor?: number;
  accessPolicy?: SlotAccessPolicy;
}): Promise<ParkingSlotDocument[]> {
  const zone = await Zone.findById(params.zoneId);
  if (!zone) {
    const err = new Error("Zone không tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  // Count existing slots in zone to determine starting index
  const existingCount = await ParkingSlot.countDocuments({ zoneId: zone._id });

  const docs = Array.from({ length: params.count }, (_, i) => {
    const num = existingCount + i + 1;
    return {
      slotCode: `${zone.name}-${String(num).padStart(2, "0")}`,
      zoneId: zone._id,
      zoneName: zone.name,
      slotType: params.slotType ?? "regular",
      features: params.features ?? [],
      status: "empty" as const,
      floor: params.floor ?? 0,
      accessPolicy: params.accessPolicy ?? "shared" as const,
    };
  });

  const created = await ParkingSlot.insertMany(docs, { ordered: false });
  return created as unknown as ParkingSlotDocument[];
}

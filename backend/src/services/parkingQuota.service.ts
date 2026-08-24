import { ParkingSlot } from "../models/ParkingSlot.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { Subscription } from "../models/Subscription.js";
import { Vehicle } from "../models/Vehicle.js";
import { Zone } from "../models/Zone.js";

export type QuotaType = "member" | "walk_in";
export type CustomerType = "member" | "guest";

export type VehicleAccessClassification = {
  customerType: CustomerType;
  quotaType: QuotaType;
  /** Biển số đã tồn tại trong hệ thống (đã đăng ký chủ xe) hay không. */
  isRegistered: boolean;
  userId?: string;
  subscriptionId?: string;
  primaryVehicleId?: string;
};

export type ParkingQuotaSummary = {
  totalCapacity: number;
  effectiveMemberSubscriptions: number;
  memberQuota: number;
  walkInQuota: number;
  memberOccupied: number;
  memberReserved: number;
  walkInOccupied: number;
  walkInReserved: number;
  memberRemaining: number;
  walkInRemaining: number;
};

export class ParkingQuotaError extends Error {
  status: number;
  code: "MEMBER_QUOTA_FULL" | "WALK_IN_QUOTA_FULL" | "PARKING_FULL";

  constructor(message: string, code: ParkingQuotaError["code"], status = 409) {
    super(message);
    this.name = "ParkingQuotaError";
    this.code = code;
    this.status = status;
  }
}

export function normalizePlate(plate: string): string {
  return plate
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

/** Sức chứa vận hành = số slot không ở maintenance; fallback về capacity zone. */
export async function getOperationalCapacity(): Promise<number> {
  const physicalCapacity = await ParkingSlot.countDocuments({
    status: { $ne: "maintenance" },
  });
  if (physicalCapacity > 0) return physicalCapacity;

  const zones = await Zone.find({ isActive: true }).select("capacity").lean();
  return zones.reduce((sum, zone) => sum + (zone.capacity ?? 0), 0);
}

export async function countEffectiveMemberSubscriptions(): Promise<number> {
  return Subscription.countDocuments({
    status: { $in: ["active", "cancelled"] },
    endDate: { $gt: new Date() },
  });
}

async function countAssigned(
  quotaType: QuotaType,
  status: "occupied" | "reserved",
): Promise<number> {
  const quotaFilter: any =
    quotaType === "walk_in" ? { $in: ["walk_in", null] } : quotaType;
  return ParkingSlot.countDocuments({ status, quotaType: quotaFilter });
}

export async function getParkingQuotaSummary(): Promise<ParkingQuotaSummary> {
  const [
    totalCapacity,
    effectiveMemberSubscriptions,
    memberOccupied,
    memberReserved,
    walkInOccupied,
    walkInReserved,
  ] = await Promise.all([
    getOperationalCapacity(),
    countEffectiveMemberSubscriptions(),
    countAssigned("member", "occupied"),
    countAssigned("member", "reserved"),
    countAssigned("walk_in", "occupied"),
    countAssigned("walk_in", "reserved"),
  ]);

  const memberQuota = Math.min(effectiveMemberSubscriptions, totalCapacity);
  const walkInQuota = Math.max(0, totalCapacity - memberQuota);
  const memberUsed = memberOccupied + memberReserved;
  const walkInUsed = walkInOccupied + walkInReserved;

  return {
    totalCapacity,
    effectiveMemberSubscriptions,
    memberQuota,
    walkInQuota,
    memberOccupied,
    memberReserved,
    walkInOccupied,
    walkInReserved,
    memberRemaining: Math.max(0, memberQuota - memberUsed),
    walkInRemaining: Math.max(0, walkInQuota - walkInUsed),
  };
}

/** Phân loại theo đúng xe + gói hiệu lực, không dựa vào userId đơn thuần. */
export async function classifyVehicleByPlate(
  plate: string,
): Promise<VehicleAccessClassification> {
  const normalizedPlate = normalizePlate(plate);
  const vehicle = await Vehicle.findOne({ plate: normalizedPlate }).select(
    "_id userId",
  );

  if (!vehicle)
    return { customerType: "guest", quotaType: "walk_in", isRegistered: false };

  const subscription = await Subscription.findOne({
    primaryVehicleId: vehicle._id,
    status: { $in: ["active", "cancelled"] },
    endDate: { $gt: new Date() },
  }).select("_id userId primaryVehicleId");

  // Biển đã đăng ký nhưng không có gói hiệu lực: dùng quota vãng lai vì không có gói,
  // song giữ cờ isRegistered=true để UI phân biệt "thành viên chưa mua gói tháng".
  if (!subscription)
    return { customerType: "guest", quotaType: "walk_in", isRegistered: true };

  return {
    customerType: "member",
    quotaType: "member",
    isRegistered: true,
    userId: subscription.userId.toString(),
    subscriptionId: subscription._id.toString(),
    primaryVehicleId: subscription.primaryVehicleId.toString(),
  };
}

/** Kiểm tra quota trước khi cấp slot hoặc giữ slot cho reservation. */
export async function assertQuotaAvailable(
  quotaType: QuotaType,
): Promise<ParkingQuotaSummary> {
  const summary = await getParkingQuotaSummary();
  const remaining =
    quotaType === "member" ? summary.memberRemaining : summary.walkInRemaining;

  if (remaining <= 0) {
    if (quotaType === "member") {
      throw new ParkingQuotaError(
        "Quota thành viên đã được sử dụng hết hoặc chưa còn slot bảo lưu cho các gói đang hiệu lực.",
        "MEMBER_QUOTA_FULL",
      );
    }
    throw new ParkingQuotaError(
      "Quota khách vãng lai đã đầy. Các slot đang bảo lưu cho thành viên không được dùng cho khách vãng lai.",
      "WALK_IN_QUOTA_FULL",
    );
  }

  const emptySlot = await ParkingSlot.exists({ status: "empty" });
  if (!emptySlot)
    throw new ParkingQuotaError(
      "Bãi xe đã hết slot vật lý khả dụng.",
      "PARKING_FULL",
    );
  return summary;
}

export function quotaErrorResponse(
  error: unknown,
): { status: number; body: { message: string; code?: string } } | null {
  if (!(error instanceof ParkingQuotaError)) return null;
  return {
    status: error.status,
    body: { message: error.message, code: error.code },
  };
}

export async function syncLegacySlotQuotaTypes(): Promise<void> {
  await ParkingSlot.updateMany(
    { quotaType: { $exists: false } },
    { $set: { quotaType: "walk_in" } },
  );
}

/**
 * Bảo lưu động member quota trên các slot đang rảnh. Khi gói hết hiệu lực,
 * chỉ slot member đang rảnh được trả về walk_in; slot đang dùng không bị đổi loại.
 */
export async function syncDynamicMemberSlotReservation(): Promise<void> {
  await syncLegacySlotQuotaTypes();
  const capacity = await getOperationalCapacity();
  const effectiveSubscriptions = await countEffectiveMemberSubscriptions();
  const targetMemberSlots = Math.min(capacity, effectiveSubscriptions);
  const memberSlots = await ParkingSlot.find({ quotaType: "member" }).sort({
    slotCode: 1,
  });
  const emptyMemberSlots = memberSlots.filter(
    (slot) => slot.status === "empty",
  );
  const occupiedOrReservedMemberSlots = memberSlots.filter(
    (slot) => slot.status === "occupied" || slot.status === "reserved",
  );
  const needMemberSlots = Math.max(
    0,
    targetMemberSlots -
      occupiedOrReservedMemberSlots.length -
      emptyMemberSlots.length,
  );

  if (needMemberSlots > 0) {
    const candidates = await ParkingSlot.find({
      quotaType: "walk_in",
      status: "empty",
    })
      .sort({ slotCode: 1 })
      .limit(needMemberSlots);
    for (const slot of candidates) {
      await ParkingSlot.updateOne(
        { _id: slot._id, status: "empty", quotaType: "walk_in" },
        { $set: { quotaType: "member" } },
      );
    }
  }

  const refreshedMemberSlots = await ParkingSlot.find({
    quotaType: "member",
  }).sort({ slotCode: 1 });
  const memberInUse = refreshedMemberSlots.filter(
    (slot) => slot.status === "occupied" || slot.status === "reserved",
  ).length;
  const excess = Math.max(
    0,
    refreshedMemberSlots.length - Math.max(targetMemberSlots, memberInUse),
  );

  if (excess > 0) {
    const releasable = refreshedMemberSlots
      .filter((slot) => slot.status === "empty")
      .slice(0, excess);
    for (const slot of releasable) {
      await ParkingSlot.updateOne(
        { _id: slot._id, status: "empty", quotaType: "member" },
        { $set: { quotaType: "walk_in" } },
      );
    }
  }

  await reconcileMemberSessionsToMemberSlots();
}

/**
 * Dời các phiên thành viên đang nằm nhầm ở slot vãng lai về đúng slot thành viên.
 *
 * Nguyên nhân gốc: có trường hợp phiên được tạo với `customerType: "member"` nhưng
 * `quotaType: "walk_in"` (ví dụ nhập thủ công khi thẻ chưa gắn đúng gói, hoặc slot
 * thành viên chưa được bảo lưu kịp). Sau đó gói thành viên được kích hoạt /
 * `syncDynamicMemberSlotReservation` bảo lưu slot thành viên, nhưng phiên cũ không
 * được nhả ra nên xe thành viên vẫn bị tính vào quota vãng lai.
 *
 * Chỉ xử lý phiên Đang gửi, có subscription hiệu lực. Nếu tìm được slot member đang
 * trống, nhả slot vãng lai cũ, chiếm slot member và cập nhật lại phiên.
 */
export async function reconcileMemberSessionsToMemberSlots(): Promise<number> {
  const activeWalkInMemberSessions = await ParkingSession.find({
    status: "Đang gửi",
    quotaType: { $ne: "member" },
    $or: [{ customerType: "member" }, { isRegisteredMember: true }],
  }).select("_id plate slot slotId customerType").lean();

  let moved = 0;
  for (const session of activeWalkInMemberSessions) {
    // Chỉ dời khi có gói thành viên hiệu lực (nếu không thì vẫn là khách trả phí).
    const access = await classifyVehicleByPlate(session.plate);
    if (access.quotaType !== "member") continue;

    const memberSlot = await ParkingSlot.findOne({
      quotaType: "member",
      status: "empty",
    }).sort({ slotCode: 1 });
    if (!memberSlot) continue;

    // Nhả slot vãng lai cũ (nếu có).
    if (session.slotId) {
      await ParkingSlot.findByIdAndUpdate(
        session.slotId,
        { $set: { status: "empty" }, $unset: { currentSessionId: "" } },
      );
    }

    // Chiếm slot member.
    await ParkingSlot.findByIdAndUpdate(memberSlot._id, {
      $set: {
        status: "occupied",
        currentSessionId: session._id,
        quotaType: "member",
      },
    });

    // Cập nhật phiên về đúng quota + phương thức thanh toán của thành viên có gói.
    await ParkingSession.updateOne(
      { _id: session._id },
      {
        $set: {
          quotaType: "member",
          slot: memberSlot.slotCode,
          slotId: memberSlot._id,
          paymentMethod: "subscription",
          paymentStatus: "fully_paid",
          fee: 0,
          paidAmount: 0,
          discountAmount: 0,
        },
      },
    );
    moved++;
  }
  return moved;
}

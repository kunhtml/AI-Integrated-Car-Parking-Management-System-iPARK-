import { CapacityChangeLogDocument } from "../models/CapacityChangeLog.js";
import { CapacityConfigDocument } from "../models/CapacityConfig.js";
import { DeviceMaintenanceLogDocument } from "../models/DeviceMaintenanceLog.js";
import { ParkingSessionDocument } from "../models/ParkingSession.js";
import { ParkingSlotDocument } from "../models/ParkingSlot.js";
import { ReservationDocument } from "../models/Reservation.js";
import { SubscriptionDocument } from "../models/Subscription.js";
import { SubscriptionPlanDocument } from "../models/SubscriptionPlan.js";
import { UserDocument } from "../models/User.js";
import { VehicleDocument } from "../models/Vehicle.js";
import { DeviceDocument } from "../models/Device.js";
import { IncidentDocument } from "../models/Incident.js";
import { NotificationDocument } from "../models/Notification.js";
import { PaymentConfigDocument } from "../models/PaymentConfig.js";
import { ShiftDocument } from "../models/Shift.js";
import { ShiftScheduleDocument } from "../models/ShiftSchedule.js";
import { TransactionDocument } from "../models/Transaction.js";
import { ZoneDocument } from "../models/Zone.js";
import type { ZoneStats } from "../services/zone.service.js";

export function serializeUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl ?? undefined,
    provider: user.provider,
    twoFactorEnabled: user.twoFactorEnabled,
    phone: user.phone ?? null,
    isVerified: user.isVerified,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeParkingSession(session: ParkingSessionDocument) {
  return {
    id: session._id.toString(),
    plate: session.plate,
    owner: session.ownerName,
    vehicleType: session.vehicleType,
    checkIn: session.checkInAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    checkInDate: session.checkInAt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
    checkInAt: session.checkInAt.toISOString(),
    checkOut: session.checkOutAt?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    checkOutDate: session.checkOutAt?.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
    expectedCheckOut: session.expectedCheckOutAt?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    expectedCheckOutDate: session.expectedCheckOutAt?.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
    expectedCheckOutAt: session.expectedCheckOutAt?.toISOString(),
    prepaidCheckoutAt: session.prepaidCheckoutAt?.toISOString(),
    prepaidCheckoutTime: session.prepaidCheckoutAt?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    prepaidCheckoutDate: session.prepaidCheckoutAt?.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
    slot: session.slot,
    slotId: session.slotId?.toString(),
    status: session.status,
    paymentStatus: session.paymentStatus,
    paymentMethod: session.paymentMethod,
    fee: session.fee,
    paidAmount: session.paidAmount,
    feeBreakdown: session.feeBreakdown,
    entryImageUrl: session.entryImageUrl,
    exitImageUrl: session.exitImageUrl,
    entryDetectedPlate: session.entryDetectedPlate,
    exitDetectedPlate: session.exitDetectedPlate,
    entryConfidence: session.entryConfidence,
    exitConfidence: session.exitConfidence,
    vehicleMatchScore: session.vehicleMatchScore,
    matchStatus: session.matchStatus,
    verificationStatus: session.verificationStatus,
    manualPlate: session.manualPlate,
    verificationNote: session.verificationNote,
    transactionId: session.transactionId?.toString(),
    ownerEmail: session.ownerEmail,
  };
}

export function serializeVehicle(
  vehicle: VehicleDocument,
  populatedUser?: { name?: string; email?: string; phone?: string | null } | null,
) {
  return {
    id: vehicle._id.toString(),
    plate: vehicle.plate,
    owner: vehicle.ownerName,
    ownerEmail: vehicle.ownerEmail ?? null,
    ownerPhone: vehicle.ownerPhone ?? null,
    ownerAddress: vehicle.ownerAddress ?? null,
    type: vehicle.vehicleType,
    brand: vehicle.brand ?? null,
    model: vehicle.model ?? null,
    color: vehicle.color ?? null,
    year: vehicle.year ?? null,
    engineNo: vehicle.engineNo ?? null,
    chassisNo: vehicle.chassisNo ?? null,
    status: vehicle.status,
    userId: vehicle.userId?.toString() ?? null,
    isCompanyVehicle: vehicle.isCompanyVehicle,
    imageUrl: vehicle.imageUrl ?? null,
    user: populatedUser ? {
      name: populatedUser.name,
      email: populatedUser.email,
      phone: populatedUser.phone ?? null,
    } : null,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

export function serializePaymentConfig(config: PaymentConfigDocument) {
  return {
    id: config._id.toString(),
    isActive: config.isActive,
    payosEnabled: config.payosEnabled,
    updatedAt: config.updatedAt,
  };
}

export function serializeTransaction(transaction: TransactionDocument, session?: ParkingSessionDocument | null) {
  return {
    id: transaction._id.toString(),
    sessionId: transaction.sessionId?.toString(),
    subscriptionId: transaction.subscriptionId?.toString(),
    penaltyId: transaction.penaltyId?.toString(),
    userId: transaction.userId?.toString(),
    method: transaction.method,
    amount: transaction.amount,
    status: transaction.status,
    paidAt: transaction.paidAt,
    note: transaction.note,
    discount: transaction.discount,
    payosOrderCode: transaction.payosOrderCode,
    payosQrCode: transaction.payosQrCode,
    payosCheckoutUrl: transaction.payosCheckoutUrl,
    payosPaymentLinkId: transaction.payosPaymentLinkId,
    // Session info
    plate: session?.plate,
    ownerName: session?.ownerName,
    ownerEmail: session?.ownerEmail,
    slot: session?.slot,
    sessionPaymentStatus: session?.paymentStatus,
    sessionFee: session?.fee ?? 0,
    sessionPaidAmount: session?.paidAmount ?? 0,
  };
}

export function serializeDevice(device: DeviceDocument) {
  return {
    id: device._id.toString(),
    name: device.name,
    gate: device.gate,
    rtspUrl: device.rtspUrl,
    username: device.username,
    roiNote: device.roiNote,
    status: device.status,
    lastSnapshotUrl: device.lastSnapshotUrl,
    lastSnapshotAt: device.lastSnapshotAt,
  };
}

export function serializeNotification(notification: NotificationDocument, userId?: string) {
  return {
    id: notification._id.toString(),
    title: notification.title,
    content: notification.content,
    targetRole: notification.targetRole,
    userId: notification.userId?.toString(),
    read: userId ? notification.readBy.some((id) => id.toString() === userId) : false,
    createdAt: notification.createdAt,
  };
}

export function serializeShift(shift: ShiftDocument) {
  return {
    id: shift._id.toString(),
    name: shift.name,
    staffId: shift.staffId.toString(),
    startAt: shift.startAt,
    endAt: shift.endAt,
    status: shift.status,
    note: shift.note,
  };
}

export function serializeShiftSchedule(
  schedule: (ShiftScheduleDocument | (ShiftScheduleDocument & {
    staffId?: string | { _id?: { toString(): string }; name?: string; email?: string; phone?: string | null; avatarUrl?: string | null };
    assignedBy?: string | { _id?: { toString(): string }; name?: string; email?: string };
  })),
) {
  const staff = schedule.staffId as { _id?: { toString: () => string }; name?: string; email?: string; phone?: string | null; avatarUrl?: string | null } | string | undefined;
  const assigned = schedule.assignedBy as { _id?: { toString: () => string }; name?: string; email?: string } | string | undefined;

  let staffId = "";
  let staffName = "";
  let staffEmail = "";
  let staffPhone: string | null = null;
  let staffAvatarUrl: string | null = null;

  if (staff) {
    if (typeof staff === "object" && "_id" in staff) {
      staffId = staff._id?.toString() || "";
      staffName = staff.name || "";
      staffEmail = staff.email || "";
      staffPhone = staff.phone || null;
      staffAvatarUrl = staff.avatarUrl || null;
    } else {
      staffId = String(staff);
    }
  }

  let assignedById = "";
  let assignedByName = "";

  if (assigned) {
    if (typeof assigned === "object" && "_id" in assigned) {
      assignedById = assigned._id?.toString() || "";
      assignedByName = assigned.name || "";
    } else {
      assignedById = String(assigned);
    }
  }

  // Handle date - it could be Date object or string
  const dateValue = schedule.date instanceof Date
    ? schedule.date.toISOString()
    : typeof schedule.date === "string"
      ? schedule.date
      : new Date(schedule.date as unknown as string).toISOString();

  return {
    id: schedule._id.toString(),
    staffId,
    staffName,
    staffEmail,
    staffPhone,
    staffAvatarUrl,
    date: dateValue,
    shiftType: schedule.shiftType,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    status: schedule.status,
    assignedBy: assignedById,
    assignedByName,
    note: schedule.note,
    location: schedule.location,
    deviceId: schedule.deviceId?.toString(),
    createdAt: schedule.createdAt instanceof Date ? schedule.createdAt.toISOString() : schedule.createdAt,
    updatedAt: schedule.updatedAt instanceof Date ? schedule.updatedAt.toISOString() : schedule.updatedAt,
  };
}

export function serializeIncident(incident: IncidentDocument) {
  return {
    id: incident._id.toString(),
    type: incident.type,
    note: incident.note,
    plate: incident.plate,
    sessionId: incident.sessionId?.toString(),
    status: incident.status,
    createdBy: incident.createdBy?.toString(),
    handledBy: incident.handledBy?.toString(),
    handledAt: incident.handledAt ? incident.handledAt.toISOString() : null,
    isRecurring: incident.isRecurring,
    createdAt: incident.createdAt.toISOString(),
  };
}

export function serializeZone(zone: ZoneDocument, stats?: ZoneStats) {
  return {
    id: zone._id.toString(),
    name: zone.name,
    description: zone.description,
    capacity: zone.capacity,
    walkInQuota: zone.walkInQuota ?? 0,
    subscriberQuota: zone.subscriberQuota ?? 0,
    allowedVehicleTypes: zone.allowedVehicleTypes,
    pricingConfigId: zone.pricingConfigId?.toString(),
    displayOrder: zone.displayOrder,
    isActive: zone.isActive,
    ...(stats ? { stats } : {}),
    updatedAt: zone.updatedAt,
  };
}

export function serializeParkingSlot(slot: ParkingSlotDocument) {
  return {
    id: slot._id.toString(),
    slotCode: slot.slotCode,
    zoneId: slot.zoneId.toString(),
    zoneName: slot.zoneName,
    slotType: slot.slotType,
    features: slot.features,
    status: slot.status,
    currentSessionId: slot.currentSessionId?.toString(),
    floor: slot.floor,
    notes: slot.notes,
    accessPolicy: slot.accessPolicy ?? "shared",
    aiPolygon: slot.aiPolygon,
    updatedAt: slot.updatedAt,
  };
}

export function serializeReservation(reservation: ReservationDocument) {
  return {
    id: reservation._id.toString(),
    userId: reservation.userId.toString(),
    slotId: reservation.slotId.toString(),
    slotCode: reservation.slotCode,
    zoneName: reservation.zoneName,
    vehicleType: reservation.vehicleType,
    plate: reservation.plate,
    reservedFrom: reservation.reservedFrom.toISOString(),
    reservedUntil: reservation.reservedUntil.toISOString(),
    status: reservation.status,
    sessionId: reservation.sessionId?.toString(),
    depositAmount: reservation.depositAmount,
    cancelledAt: reservation.cancelledAt?.toISOString(),
    cancelReason: reservation.cancelReason,
    createdAt: reservation.createdAt.toISOString(),
  };
}

export function serializeSubscriptionPlan(plan: SubscriptionPlanDocument) {
  return {
    id: plan._id.toString(),
    name: plan.name,
    description: plan.description,
    duration: plan.duration,
    durationDays: plan.durationDays,
    price: plan.price,
    // null = không giới hạn. Client sẽ check null để hiển thị "Không giới hạn".
    maxVehicles: plan.maxVehicles,
    isActive: plan.isActive,
  };
}

export function serializeSubscription(sub: SubscriptionDocument) {
  // `primaryVehicleId` có thể là ObjectId thuần hoặc đã populate Vehicle doc.
  let primaryVehicleId: string | null = null;
  let primaryVehicle: Record<string, unknown> | null = null;
  const ref = (sub as any).primaryVehicleId;
  if (ref) {
    if (typeof ref === "object" && "_id" in ref && "plate" in ref) {
      const v = ref;
      primaryVehicleId = v._id.toString();
      primaryVehicle = {
        id: primaryVehicleId,
        plate: v.plate,
        ownerName: v.ownerName,
        brand: v.brand ?? null,
        model: (v as any).model ?? null,
        color: v.color ?? null,
        engineNo: v.engineNo ?? null,
        chassisNo: v.chassisNo ?? null,
        year: v.year ?? null,
        status: v.status ?? null,
      };
    } else {
      primaryVehicleId = String(ref);
    }
  }

  return {
    id: sub._id.toString(),
    userId: sub.userId.toString(),
    planId: sub.planId.toString(),
    planName: sub.planName,
    primaryVehicleId,
    primaryVehicle,
    memberCode: sub.memberCode ?? null,
    startDate: sub.startDate.toISOString(),
    endDate: sub.endDate.toISOString(),
    status: sub.status,
    autoRenew: sub.autoRenew,
    transactionId: sub.transactionId?.toString(),
    renewalCount: sub.renewalCount,
    createdAt: sub.createdAt.toISOString(),
  };
}

/**
 * Phiên bản dành cho admin: kèm thông tin tài khoản khách hàng đang dùng gói.
 * Trả về null khi user đã bị xoá khỏi hệ thống.
 */
export function serializeSubscriptionForAdmin(
  sub: SubscriptionDocument,
  user: UserDocument | null,
) {
  const base = serializeSubscription(sub);
  if (!user) {
    return { ...base, user: null };
  }
  return {
    ...base,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      status: user.status,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

export function serializeMaintenanceLog(log: DeviceMaintenanceLogDocument) {
  return {
    id: log._id.toString(),
    deviceId: log.deviceId.toString(),
    deviceName: log.deviceName,
    type: log.type,
    description: log.description,
    performedBy: log.performedBy?.toString(),
    performedAt: log.performedAt.toISOString(),
    cost: log.cost,
    notes: log.notes,
    status: log.status,
    createdAt: log.createdAt.toISOString(),
  };
}

export function serializeCapacityConfig(config: CapacityConfigDocument) {
  return {
    id: config._id.toString(),
    key: config.key,
    globalCapacity: config.globalCapacity,
    updatedBy: config.updatedBy ? config.updatedBy.toString() : null,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

type CapacityChangeLogPopulated = CapacityChangeLogDocument & {
  changedBy?: { _id?: unknown; name?: string; email?: string | null } | null;
  zoneId?: { _id?: unknown; name?: string } | null;
};

export function serializeCapacityChangeLog(log: CapacityChangeLogPopulated) {
  const changedByRaw = log.changedBy as unknown as
    | { _id?: unknown; name?: string; email?: string }
    | null
    | undefined;
  const zoneRaw = log.zoneId as unknown as { _id?: unknown; name?: string } | null | undefined;
  return {
    id: log._id.toString(),
    entityType: log.entityType,
    zoneId: zoneRaw ? (zoneRaw._id ? String(zoneRaw._id) : null) : log.zoneId?.toString() ?? null,
    zoneName: zoneRaw?.name ?? null,
    before: log.before,
    after: log.after,
    changedBy: changedByRaw
      ? {
          id: changedByRaw._id ? String(changedByRaw._id) : null,
          name: changedByRaw.name ?? null,
          email: changedByRaw.email ?? null,
        }
      : null,
    changedAt: log.changedAt.toISOString(),
    reason: log.reason ?? null,
  };
}

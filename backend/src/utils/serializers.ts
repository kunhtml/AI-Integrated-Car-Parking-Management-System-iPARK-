import type { RecognitionLogDocument } from "../models/RecognitionLog.js";

function formatTime(value?: Date) {
  if (!value) {
    return undefined;
  }

  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function serializeParkingSession(session: any) {
  return {
    id: session._id?.toString(),
    plate: session.plate,
    owner: session.ownerName,
    vehicleType: session.vehicleType,
    checkIn: formatTime(session.checkInAt) || "",
    checkOut: formatTime(session.checkOutAt),
    slot: session.slot,
    status: session.status,
    fee: session.fee || 0,
    paymentStatus: session.paymentStatus,
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
    transactionId: session.transactionId?.toString?.(),
    feeBreakdown: session.feeBreakdown,
    ownerEmail: session.ownerEmail,
    paidAmount: session.paidAmount ?? 0,
    checkInDate: session.checkInAt ? new Date(session.checkInAt).toLocaleDateString("vi-VN") : "",
    createdAt: session.createdAt,
  };
}

export function serializeUser(user: any) {
  return {
    id: user._id?.toString?.() || user.id || "",
    name: user.name || user.email || "",
    email: user.email,
    role: user.role || "customer",
    status: user.status || "Đang hoạt động",
    wallet: user.wallet ?? 0,
    avatarUrl: user.avatarUrl,
    provider: user.provider,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
    createdAt: user.createdAt,
  };
}

export function serializeVehicle(vehicle: any) {
  return {
    id: vehicle._id?.toString?.() || vehicle.id || "",
    plate: vehicle.plate,
    owner: vehicle.ownerName,
    type: vehicle.vehicleType,
    status: vehicle.status,
  };
}

export function serializePricingConfig(config: any) {
  return {
    id: config._id?.toString?.() || config.id || "",
    freeMinutes: config.freeMinutes || 0,
    hourlyRate: config.hourlyRate || 0,
    overnightRate: config.overnightRate || 0,
    monthlyRate: config.monthlyRate || 0,
    overdueFineRate: config.overdueFineRate || 0,
    dailyMaxRate: config.dailyMaxRate || 0,
    graceExitMinutes: config.graceExitMinutes || 0,
    effectiveFrom: config.effectiveFrom,
    isActive: Boolean(config.isActive),
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export function serializeMembershipPackage(pkg: any) {
  return {
    id: pkg._id?.toString?.() || pkg.id || "",
    name: pkg.name,
    code: pkg.code,
    billingCycle: pkg.billingCycle,
    price: pkg.price || 0,
    durationDays: pkg.durationDays || 0,
    subscriberCount: pkg.subscriberCount || 0,
    renewalRate: pkg.renewalRate || 0,
    status: pkg.status || "Draft",
    features: pkg.features || [],
    note: pkg.note || "",
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
}

export function serializeTransaction(item: any, session?: any) {
  return {
    id: item._id?.toString?.() || item.id || "",
    sessionId: item.sessionId?.toString?.() || item.sessionId || "",
    userId: item.userId?.toString?.() || item.userId || "",
    method: item.method,
    amount: item.amount || 0,
    status: item.status,
    content: item.content,
    qrUrl: item.qrUrl,
    paidAt: item.paidAt,
    note: item.note,
    createdAt: item.createdAt,
    payosCheckoutUrl: item.payosCheckoutUrl,
    sessionFee: session?.fee || 0,
    sessionPaidAmount: session?.paidAmount || 0,
    sessionPaymentStatus: session?.paymentStatus || "unpaid",
    plate: session?.plate,
    ownerName: session?.ownerName,
    ownerEmail: session?.ownerEmail,
    slot: session?.slot,
    session: session ? serializeParkingSession(session) : undefined,
  };
}

export function serializeReportExport(item: any) {
  return {
    id: item._id?.toString?.() || item.id || "",
    fileName: item.fileName,
    reportType: item.reportType || "revenue",
    format: item.format,
    period: item.period,
    createdBy: item.createdBy?.toString?.() || item.createdBy || "System",
    status: item.status || "Ready",
    createdAt: item.createdAt,
  };
}

export function serializeZone(
  zone: any,
  stats?: { total: number; empty: number; occupied: number },
) {
  return {
    id: zone._id?.toString?.() || zone.id || "",
    name: zone.name,
    description: zone.description,
    capacity: zone.capacity,
    allowedVehicleTypes: zone.allowedVehicleTypes || ["Ô tô"],
    displayOrder: zone.displayOrder ?? 0,
    isActive: Boolean(zone.isActive),
    stats: stats ?? { total: zone.capacity, empty: zone.capacity, occupied: 0 },
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
  };
}

export function serializeDevice(device: any) {
  return {
    id: device._id?.toString?.() || device.id || "",
    name: device.name,
    gate: device.gate,
    rtspUrl: device.rtspUrl,
    httpUrl: device.httpUrl,
    username: device.username,
    password: device.password,
    deviceType: device.deviceType || "rtsp",
    roiNote: device.roiNote,
    roi: device.roi || null,
    snapshotPath: device.snapshotPath || "",
    streamPath: device.streamPath || `/devices/${device._id?.toString?.()}/stream`,
    status: device.status,
    lastSnapshotUrl: device.lastSnapshotUrl,
    lastSnapshotAt: device.lastSnapshotAt,
    maintenanceSchedule: device.maintenanceSchedule,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  };
}

export function serializeRecognitionLog(log: RecognitionLogDocument) {
  return {
    id: log._id.toString(),
    action: log.action,
    source: log.source,
    status: log.status,
    plate: log.plate,
    detectedPlate: log.detectedPlate,
    confidence: log.confidence,
    rawText: log.rawText,
    imageHash: log.imageHash,
    imageUrl: log.imageUrl,
    vehicleType: log.vehicleType,
    sessionId: log.sessionId?.toString() ?? "",
    deviceId: log.deviceId?.toString() ?? "",
    deviceName: log.deviceName,
    matched: log.matched,
    matchStatus: log.matchStatus,
    vehicleMatchScore: log.vehicleMatchScore,
    message: log.message,
    createdBy: log.createdBy?.toString() ?? "",
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

export function serializeMaintenanceLog(log: any) {
  return {
    id: log._id?.toString?.() || log.id || "",
    deviceId: log.deviceId?.toString?.() || log.deviceId || "",
    deviceName: log.deviceName,
    type: log.type,
    description: log.description,
    performedBy: log.performedBy?.toString?.() || log.performedBy || "",
    performedAt: log.performedAt,
    cost: log.cost || 0,
    notes: log.notes,
    status: log.status,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

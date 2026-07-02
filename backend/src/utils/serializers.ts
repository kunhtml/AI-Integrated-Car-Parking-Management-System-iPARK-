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
    phone: user.phone || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    gender: user.gender || "",
    dob: user.dob || "",
    idCardNumber: user.idCardNumber || "",
    idCardIssueDate: user.idCardIssueDate || "",
    idCardExpiryDate: user.idCardExpiryDate || "",
    address: user.address || "",
    city: user.city || "",
    district: user.district || "",
    emergencyContactName: user.emergencyContactName || "",
    emergencyContactPhone: user.emergencyContactPhone || "",
    company: user.company || "",
    taxId: user.taxId || "",
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
    freeMinutes: config.freeMinutes ?? 20,
    hourlyRate: config.hourlyRate ?? 5000,
    overnightRate: config.overnightRate ?? 10000,
    dayStartHour: config.dayStartHour ?? 6,
    nightStartHour: config.nightStartHour ?? 22,
    monthlyRate: config.monthlyRate ?? 1200000,
    overdueFineRate: config.overdueFineRate ?? 50000,
    dailyMaxRate: config.dailyMaxRate ?? 120000,
    graceExitMinutes: config.graceExitMinutes ?? 10,
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
    maxPlates: pkg.maxPlates ?? -1,
    subscriberCount: pkg.subscriberCount || 0,
    renewalRate: pkg.renewalRate || 0,
    status: pkg.status || "Draft",
    features: pkg.features || [],
    note: pkg.note || "",
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
}

export function serializeTransaction(item: any) {
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

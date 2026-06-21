export function serializeParkingSession(session: any) {
  return {
    id: session._id?.toString(),
    licensePlate: session.licensePlate,
    checkInAt: session.checkInAt,
    checkOutAt: session.checkOutAt,
    zone: session.zone,
    slot: session.slot,
    fee: session.fee,
    paid: session.paid,
    status: session.status,
    cameraId: session.cameraId,
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
    createdAt: user.createdAt,
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

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

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

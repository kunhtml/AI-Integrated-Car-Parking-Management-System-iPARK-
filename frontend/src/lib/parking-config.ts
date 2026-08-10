export const parkingConfig = {
  brandName: "iPARK",
  address: "Hòa Lạc, Thạch Thất, Hà Nội",
  contactEmail: "support@ipark.vn",
  hotline: "Chưa cung cấp",
  totalCapacity: 30,
  zones: ["A", "B", "C"],
  slotsPerZone: 10,
  supportedVehicleTypes: ["Ô tô"] as const,
  freeMinutes: 20,
  hourlyRate: 0,
  overnightRate: 0,
  monthlyRate: 0,
  overdueFineRate: 0,
};

export type SupportedVehicleType = (typeof parkingConfig.supportedVehicleTypes)[number];

export function allocateCarSlot(activeCount: number) {
  const index = activeCount % parkingConfig.totalCapacity;
  const zone = parkingConfig.zones[Math.floor(index / parkingConfig.slotsPerZone)] ?? "A";
  const slotNumber = (index % parkingConfig.slotsPerZone) + 1;
  return `${zone}-${String(slotNumber).padStart(2, "0")}`;
}

export function calculateParkingFee(checkInAt: Date, checkOutAt: Date) {
  const diffMs = checkOutAt.getTime() - checkInAt.getTime();
  const minutes = Math.max(0, Math.ceil(diffMs / 60000));

  if (minutes <= parkingConfig.freeMinutes) {
    return 0;
  }

  if (!parkingConfig.hourlyRate) {
    return 0;
  }

  const billableHours = Math.ceil((minutes - parkingConfig.freeMinutes) / 60);
  return billableHours * parkingConfig.hourlyRate;
}

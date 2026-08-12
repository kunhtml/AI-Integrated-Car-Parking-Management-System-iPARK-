/**
 * Static branding/contact config for iPARK.
 * Capacity and zone data are now managed dynamically via the Zone and ParkingSlot models.
 */
export const parkingConfig = {
  totalCapacity: Number(process.env.PARKING_TOTAL_CAPACITY || 100),
  brandName: "iPARK",
  address: "Hòa Lạc, Thạch Thất, Hà Nội",
  contactEmail: "support@ipark.vn",
  hotline: "Chưa cung cấp",
};

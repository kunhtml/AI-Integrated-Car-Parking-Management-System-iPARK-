import { PricingConfig, PricingConfigDocument } from "../models/PricingConfig.js";

export type FeeBreakdown = {
  totalMinutes: number;
  freeMinutes: number;
  billableMinutes: number;
  billableHours: number;
  hourlyRate: number;
  parkingFee: number;
  overdueFine: number;
  totalFee: number;
};

export async function getActivePricingConfig() {
  const config = await PricingConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (config) {
    return config;
  }

  return PricingConfig.create({
    freeMinutes: 20,
    hourlyRate: 10000,
    overnightRate: 80000,
    monthlyRate: 1200000,
    overdueFineRate: 50000,
    dailyMaxRate: 120000,
    graceExitMinutes: 10,
    isActive: true,
  });
}

export function calculateParkingFee(
  checkInAt: Date,
  checkOutAt: Date,
  pricing: PricingConfigDocument,
): FeeBreakdown {
  const totalMinutes = Math.max(0, Math.ceil((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
  const billableMinutes = Math.max(0, totalMinutes - pricing.freeMinutes);
  const billableHours = billableMinutes > 0 ? Math.ceil(billableMinutes / 60) : 0;
  const parkingFee = billableHours * pricing.hourlyRate;
  const totalFee = Math.min(parkingFee, pricing.dailyMaxRate || parkingFee);

  return {
    totalMinutes,
    freeMinutes: pricing.freeMinutes,
    billableMinutes,
    billableHours,
    hourlyRate: pricing.hourlyRate,
    parkingFee,
    overdueFine: 0,
    totalFee,
  };
}

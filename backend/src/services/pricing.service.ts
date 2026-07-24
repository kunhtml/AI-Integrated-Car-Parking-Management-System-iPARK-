import { PricingConfig, PricingConfigDocument } from "../models/PricingConfig.js";
import { Zone } from "../models/Zone.js";

export type FeeBreakdown = {
  totalMinutes: number;
  freeMinutes: number;
  billableMinutes: number;
  billableHours: number;
  hourlyRate: number;
  parkingFee: number;
  overdueFine: number;
  totalFee: number;
  dayRate?: number;
  nightRate?: number;
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

// UC29: Per-zone pricing support
export async function getActivePricingConfigForZone(zoneId?: any) {
  if (!zoneId) {
    return getActivePricingConfig();
  }

  // Check if zone has custom pricing
  const zone = await Zone.findById(zoneId);
  if (zone) {
    // For now, use global config. Zone-specific pricing can be added
    // by adding a pricingConfigId field to Zone model
    return getActivePricingConfig();
  }

  return getActivePricingConfig();
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

  // UC59: Calculate overdue fine
  let overdueFine = 0;
  if (pricing.overdueFineRate && pricing.graceExitMinutes) {
    // Check if session exceeds expected checkout (if set)
    // For now, calculate based on max daily duration exceeded
    const maxDailyMinutes = 24 * 60; // 24 hours
    if (totalMinutes > maxDailyMinutes + pricing.graceExitMinutes) {
      const overdueDays = Math.ceil((totalMinutes - maxDailyMinutes - pricing.graceExitMinutes) / (24 * 60));
      overdueFine = overdueDays * pricing.overdueFineRate;
    }
  }

  const totalFee = Math.min(parkingFee, pricing.dailyMaxRate || parkingFee) + overdueFine;

  return {
    totalMinutes,
    freeMinutes: pricing.freeMinutes,
    billableMinutes,
    billableHours,
    hourlyRate: pricing.hourlyRate,
    parkingFee,
    overdueFine,
    totalFee,
  };
}

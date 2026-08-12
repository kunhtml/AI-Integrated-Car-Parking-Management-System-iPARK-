import mongoose from "mongoose";
import { PricingConfig, PricingConfigDocument } from "../models/PricingConfig.js";
import { Zone } from "../models/Zone.js";

export const defaultPricingConfig = {
  dayRate: 5000,
  nightRate: 10000,
  dayStartHour: 6,
  nightStartHour: 22,
  gracePeriod: 20,
  maxMinutes: 1440,
};

// Mức phạt quá hạn cố định (VND / 30 phút) — không còn cấu hình qua admin.
export const OVERDUE_FINE_RATE = 20000;

export type FeeBreakdown = {
  totalMinutes: number;
  freeMinutes: number;
  billableMinutes: number;
  billableHours: number;
  hourlyRate: number;
  parkingFee: number;
  overdueFine: number;
  totalFee: number;
  dailyBreakdown: DailyBreakdownItem[];
};

export type DailyRateType = "day" | "night";
export type DailyBreakdownItem = {
  dayIndex: number;
  date: string;
  rateType: DailyRateType;
  fee: number;
  checkOutHour: number;
};

export async function getActivePricingConfig() {
  const config = await PricingConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (config) {
    return config;
  }

  return PricingConfig.create({
    ...defaultPricingConfig,
    isActive: true,
  });
}

export async function updateActivePricingConfig(
  values: Partial<typeof defaultPricingConfig>,
  updatedBy?: string,
) {
  const update = {
    ...values,
    isActive: true,
    ...(updatedBy && mongoose.isValidObjectId(updatedBy)
      ? { updatedBy: new mongoose.Types.ObjectId(updatedBy) }
      : {}),
  };

  const config = await PricingConfig.findOneAndUpdate({ isActive: true }, update, {
    returnDocument: "after",
    upsert: true,
    setDefaultsOnInsert: true,
  });

  return config;
}

/**
 * Tính phí theo ngày cho khách vãng lai:
 * - Giờ ra trong [dayStartHour, nightStartHour)  → day rate
 * - Giờ ra ngoài khoảng đó (>= nightStartHour hoặc < dayStartHour) → night rate
 * Mỗi calendar day gửi xe được tính phí 1 lần. Các mốc giờ do admin cấu hình.
 */
export function calculateParkingFee(
  checkInAt: Date,
  checkOutAt: Date,
  config: Pick<PricingConfigDocument, "dayRate" | "nightRate"> &
    Partial<Pick<PricingConfigDocument, "dayStartHour" | "nightStartHour" | "freeMinutes" | "gracePeriod">>,
): FeeBreakdown {
  const dailyBreakdown: DailyBreakdownItem[] = [];

  const dayRate = config.dayRate ?? 5000;
  const nightRate = config.nightRate ?? 10000;
  const dayStartHour = config.dayStartHour ?? 6;
  const nightStartHour = config.nightStartHour ?? 22;

  // Adjust checkInAt to the start of its calendar day
  const checkInDay = startOfCalendarDay(checkInAt);
  const checkOutDay = startOfCalendarDay(checkOutAt);

  let dayIndex = 0;
  let currentDay = new Date(checkInDay);

  while (currentDay <= checkOutDay) {
    // Determine exit hour for this calendar day
    // If checkout is on this day, use checkout hour; otherwise use 23:59
    const isCheckoutDay = currentDay.getTime() === checkOutDay.getTime();
    const exitHour = isCheckoutDay
      ? checkOutAt.getHours() + checkOutAt.getMinutes() / 60
      : 24; // treat full-day stays as exiting at midnight (charged as night)

    const rateType: DailyRateType =
      exitHour >= dayStartHour && exitHour < nightStartHour ? "day" : "night";
    const fee = rateType === "day" ? dayRate : nightRate;

    dailyBreakdown.push({
      dayIndex,
      date: `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, "0")}-${String(currentDay.getDate()).padStart(2, "0")}`,
      rateType,
      fee,
      checkOutHour: exitHour,
    });

    dayIndex++;
    currentDay.setDate(currentDay.getDate() + 1);
  }

  const totalMinutes = Math.max(
    0,
    Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000),
  );
  const freeMinutes = config.gracePeriod ?? config.freeMinutes ?? 20;
  const totalFee = totalMinutes <= freeMinutes
    ? 0
    : dailyBreakdown.reduce((sum, d) => sum + d.fee, 0);

  return {
    totalMinutes,
    freeMinutes,
    billableMinutes: Math.max(0, totalMinutes - freeMinutes),
    billableHours: 0,
    hourlyRate: 0,
    parkingFee: totalFee,
    overdueFine: 0,
    totalFee,
    dailyBreakdown,
  };
}

function startOfCalendarDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}


/**
 * Get pricing config for a specific zone.
 * If zone has a custom pricingConfigId, use that config.
 * Otherwise fall back to the global active pricing config.
 */
export async function getActivePricingConfigForZone(
  zoneId?: mongoose.Types.ObjectId | string | null,
): Promise<PricingConfigDocument> {
  if (zoneId && mongoose.isValidObjectId(zoneId)) {
    const zone = await Zone.findById(zoneId);
    if (zone?.pricingConfigId) {
      const zoneConfig = await PricingConfig.findById(zone.pricingConfigId);
      if (zoneConfig) return zoneConfig;
    }
  }
  return getActivePricingConfig();
}

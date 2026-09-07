import mongoose from "mongoose";
import { PricingConfig, PricingConfigDocument } from "../models/PricingConfig.js";
import { Zone } from "../models/Zone.js";

export const defaultPricingConfig = {
  dayRate: 5000,
  rfidCardSalePrice: 50000,
  nightRate: 10000,
  dayStartHour: 6,
  nightStartHour: 22,
  gracePeriod: 20,
  maxMinutes: 1440,
};

// Mức phạt quá hạn mặc định (VND / 30 phút) — dùng làm fallback nếu DB chưa cấu hình.
export const OVERDUE_FINE_RATE = 20000;

/**
 * Lấy mức phạt quá hạn từ cấu hình active, fallback về hằng số mặc định.
 */
export async function getOverdueFineRate(): Promise<number> {
  const config = await getActivePricingConfig();
  return (config as any).overdueFineRate ?? OVERDUE_FINE_RATE;
}

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

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * Vietnam wall-clock parts for an instant — dùng Intl với timeZone cố định
 * thay vì cộng tay +7h (server có thể chạy UTC hoặc timezone khác).
 */
export function getVietnamWallClock(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIETNAM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const hour = value("hour") % 24; // en-GB có thể trả "24" lúc nửa đêm
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour,
    minute: value("minute"),
    second: value("second"),
  };
}

function vietnamDateString(date: Date) {
  const { year, month, day } = getVietnamWallClock(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Tạo mốc UTC instant ứng với giờ `hour`:`minute` cùng ngày Vietnam `viDate`.
 * (Asia/Ho_Chi_Minh = UTC+7 quanh năm, không DST.)
 */
function vietnamInstant(viDate: { year: number; month: number; day: number }, hour: number, minute = 0) {
  return new Date(Date.UTC(viDate.year, viDate.month - 1, viDate.day, hour, minute, 0, 0) - 7 * 60 * 60 * 1000);
}

/** Cong them n ngay vao mot ngay Vietnam (y-m-d), khong quan tam timezone. */
export function viDateAddDays(viDate: { year: number; month: number; day: number }, days: number) {
  const shifted = new Date(Date.UTC(viDate.year, viDate.month - 1, viDate.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * Tao instant UTC tu gio wall-clock VIETNAM (y-m-d, hour) — thay the
 * new Date(year, month-1, day, hour) theo timezone server.
 */
export function vietnamInstantFromWallClock(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - 7 * 60 * 60 * 1000);
}

export type FeeSegment = {
  rateType: DailyRateType;
  from: Date;
  to: Date;
  minutes: number;
};

/**
 * Chia khoảng [checkInAt, checkOutAt) thành các segment ngày/đêm theo
 * mốc dayStartHour/nightStartHour giờ Vietnam.
 */
export function splitIntoRateSegments(
  checkInAt: Date,
  checkOutAt: Date,
  dayStartHour: number,
  nightStartHour: number,
): FeeSegment[] {
  const segments: FeeSegment[] = [];
  if (checkOutAt.getTime() <= checkInAt.getTime()) return segments;

  const dayRateType: DailyRateType = "day";
  const nightRateType: DailyRateType = "night";

  // Tìm ngày Vietnam của check-in, rồi duyệt từng mốc chuyển ngày/đêm.
  const startParts = getVietnamWallClock(checkInAt);
  const viStart = { year: startParts.year, month: startParts.month, day: startParts.day };

  const rateAtInstant = (date: Date): DailyRateType => {
    const { hour } = getVietnamWallClock(date);
    return hour >= dayStartHour && hour < nightStartHour ? dayRateType : nightRateType;
  };

  // Danh sách các mốc chuyển tiếp (giờ Vietnam) từ check-in tới check-out.
  const boundaries: Date[] = [];
  for (let dayOffset = -1; dayOffset <= 61; dayOffset++) {
    const base = new Date(
      Date.UTC(viStart.year, viStart.month - 1, viStart.day + dayOffset) - 7 * 60 * 60 * 1000,
    );
    boundaries.push(vietnamInstant({ year: viStart.year, month: viStart.month, day: viStart.day + dayOffset }, dayStartHour));
    boundaries.push(vietnamInstant({ year: viStart.year, month: viStart.month, day: viStart.day + dayOffset }, nightStartHour));
    void base;
  }

  let cursor = new Date(checkInAt.getTime());
  let currentRate = rateAtInstant(cursor);
  const sorted = boundaries
    .filter((b) => b.getTime() > checkInAt.getTime() && b.getTime() < checkOutAt.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  for (const boundary of sorted) {
    if (boundary.getTime() <= cursor.getTime()) continue;
    const nextRate = rateAtInstant(boundary);
    if (nextRate !== currentRate) {
      segments.push({
        rateType: currentRate,
        from: cursor,
        to: boundary,
        minutes: Math.ceil((boundary.getTime() - cursor.getTime()) / 60000),
      });
      cursor = new Date(boundary.getTime());
      currentRate = nextRate;
    }
  }

  if (cursor.getTime() < checkOutAt.getTime()) {
    segments.push({
      rateType: currentRate,
      from: cursor,
      to: new Date(checkOutAt.getTime()),
      minutes: Math.ceil((checkOutAt.getTime() - cursor.getTime()) / 60000),
    });
  }

  return segments;
}

/**
 * Tính phí gửi xe khách vãng lai — PRORATE theo mốc ngày/đêm giờ Vietnam:
 * - Khung ngày  [dayStartHour, nightStartHour) → day rate
 * - Khung đêm   ngoài khung ngày               → night rate
 * Mỗi phần của thời gian gửi được tính theo rate của khung nó rơi vào
 * (rate tính trên phút: rate / 24h), cộng dồn thành tổng.
 * Grace period (freeMinutes) được khấu trừ từ đầu khoảng, miễn phí.
 */
export function calculateParkingFee(
  checkInAt: Date,
  checkOutAt: Date,
  config: Pick<PricingConfigDocument, "dayRate" | "nightRate"> &
    Partial<Pick<PricingConfigDocument, "dayStartHour" | "nightStartHour" | "freeMinutes" | "gracePeriod">>,
): FeeBreakdown {
  const dayRate = config.dayRate ?? 5000;
  const nightRate = config.nightRate ?? 10000;
  const dayStartHour = config.dayStartHour ?? 6;
  const nightStartHour = config.nightStartHour ?? 22;

  const totalMinutes = Math.max(
    0,
    Math.ceil((checkOutAt.getTime() - checkInAt.getTime()) / 60000),
  );
  const freeMinutes = config.gracePeriod ?? config.freeMinutes ?? 20;

  const dailyBreakdown: DailyBreakdownItem[] = [];

  if (totalMinutes <= freeMinutes) {
    return {
      totalMinutes,
      freeMinutes,
      billableMinutes: 0,
      billableHours: 0,
      hourlyRate: 0,
      parkingFee: 0,
      overdueFine: 0,
      totalFee: 0,
      dailyBreakdown,
    };
  }

  // Bỏ freeMinutes khỏi đầu khoảng gửi (grace period miễn phí).
  const billableStart = new Date(checkInAt.getTime() + freeMinutes * 60000);

  const segments = splitIntoRateSegments(billableStart, checkOutAt, dayStartHour, nightStartHour);
  const DAY_WINDOW_MINUTES = 24 * 60;
  const ratePerMinute = (rateType: DailyRateType) =>
    (rateType === "day" ? dayRate : nightRate) / DAY_WINDOW_MINUTES;

  let totalFee = 0;
  // Gộp các segment liên tiếp cùng rateType trong cùng ngày Vietnam để breakdown dễ đọc.
  for (const segment of segments) {
    const perDay = ratePerMinute(segment.rateType) * segment.minutes;
    totalFee += perDay;

    const last = dailyBreakdown[dailyBreakdown.length - 1];
    if (
      last &&
      last.rateType === segment.rateType &&
      last.date === vietnamDateString(segment.from)
    ) {
      last.fee += perDay;
      last.checkOutHour = getVietnamWallClock(segment.to).hour;
    } else {
      dailyBreakdown.push({
        dayIndex: dailyBreakdown.length,
        date: vietnamDateString(segment.from),
        rateType: segment.rateType,
        fee: perDay,
        checkOutHour: getVietnamWallClock(segment.to).hour,
      });
    }
  }

  // Làm tròn tổng về VND nguyên (không làm tròn từng phần để tránh cộng dồn sai lệch).
  totalFee = Math.round(totalFee);

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

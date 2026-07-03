import { PricingConfig, PricingConfigDocument } from "../models/PricingConfig.js";
import { Subscription } from "../models/Subscription.js";
import { Vehicle } from "../models/Vehicle.js";

export type FeeBreakdown = {
  totalMinutes: number;
  freeMinutes: number;
  billableMinutes: number;
  billableHours: number;
  dayHours: number;
  nightHours: number;
  hourlyRate: number;
  overnightRate: number;
  baseParkingFee: number;
  dailyMaxCapApplied: boolean;
  parkingFee: number;

  // Package Validation
  packageValid: boolean;
  packageName?: string;
  packageExpiry?: string;
  packageDiscount: number;

  // Fine Rules
  overdueMinutes: number;
  overdueFine: number;
  fineReason?: string;
  fineRulesApplied: string[];

  totalFee: number;
  processLogs: string[];
};

export async function getActivePricingConfig() {
  const config = await PricingConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (config) {
    return config;
  }

  return PricingConfig.create({
    freeMinutes: 20,
    hourlyRate: 5000,
    overnightRate: 10000,
    dayStartHour: 6,
    nightStartHour: 22,
    monthlyRate: 1200000,
    overdueFineRate: 50000,
    dailyMaxRate: 120000,
    graceExitMinutes: 10,
    isActive: true,
  });
}

/**
 * Auto Validate Parking Package
 */
export async function autoValidatePackage(plate?: string, ownerUserId?: string) {
  if (!plate && !ownerUserId) {
    return { valid: false, message: "Chưa cung cấp thông tin biển số hoặc người dùng." };
  }

  const cleanPlate = plate?.toUpperCase().trim();
  let vehicle = cleanPlate ? await Vehicle.findOne({ plate: cleanPlate }) : null;
  const userId = ownerUserId || vehicle?.userId;

  if (userId) {
    const sub = await Subscription.findOne({
      userId,
      status: { $in: ["active", "cancelled"] },
      endDate: { $gt: new Date() },
    }).populate("planId");

    if (sub) {
      const planName = (sub.planId as any)?.name || "Gói Đăng Ký Tháng";
      return {
        valid: true,
        packageName: planName,
        packageExpiry: sub.endDate.toISOString().slice(0, 10),
        message: `Đã xác thực thành công: Xe sở hữu gói "${planName}" (Hạn đến ${sub.endDate.toLocaleDateString("vi-VN")}).`,
      };
    }
  }

  return {
    valid: false,
    message: cleanPlate ? `Biển số ${cleanPlate} không có gói đỗ xe còn hiệu lực.` : "Không có gói đỗ xe còn hiệu lực.",
  };
}

/**
 * Automated System Process: Auto Calculate Parking Fee & Auto Apply Fine Rules
 */
export function calculateParkingFee(
  checkInAt: Date,
  checkOutAt: Date,
  pricing: PricingConfigDocument,
  packageInfo?: { valid: boolean; packageName?: string; packageExpiry?: string },
): FeeBreakdown {
  const processLogs: string[] = [];
  const startMs = checkInAt.getTime();
  const endMs = checkOutAt.getTime();
  const totalMinutes = Math.max(0, Math.ceil((endMs - startMs) / 60000));
  const freeMinutes = pricing.freeMinutes ?? 20;

  processLogs.push(`[1. THỜI GIAN] Tổng thời gian đỗ: ${totalMinutes} phút (Miễn phí ${freeMinutes} phút đầu).`);

  // 1. AUTO VALIDATE PARKING PACKAGE
  let packageValid = Boolean(packageInfo?.valid);
  let packageName = packageInfo?.packageName;
  let packageExpiry = packageInfo?.packageExpiry;
  let packageDiscount = 0;

  if (packageValid) {
    processLogs.push(`[2. TỰ ĐỘNG XÁC THỰC GÓI] Áp dụng gói "${packageName}" thành công (Hạn đến: ${packageExpiry}). Miễn phí đỗ xe.`);
  } else {
    processLogs.push(`[2. TỰ ĐỘNG XÁC THỰC GÓI] Không có gói đỗ xe áp dụng. Tính phí theo bảng giá hiện hành.`);
  }

  // 2. AUTO CALCULATE PARKING FEE (Day / Night Rate Calculation)
  let dayHours = 0;
  let nightHours = 0;
  const dayStart = pricing.dayStartHour ?? 6;
  const nightStart = pricing.nightStartHour ?? 22;
  const dayRate = pricing.hourlyRate ?? 5000;
  const nightRate = pricing.overnightRate ?? 10000;

  const billableMinutes = Math.max(0, totalMinutes - freeMinutes);
  const billableHours = billableMinutes > 0 ? Math.ceil(billableMinutes / 60) : 0;

  if (billableHours > 0) {
    // Distribute billable hours into Day vs Night
    let currentMs = startMs + freeMinutes * 60000;
    for (let i = 0; i < billableHours; i++) {
      const hourDate = new Date(currentMs);
      const h = hourDate.getHours();
      const isDaytime = h >= dayStart && h < nightStart;
      if (isDaytime) {
        dayHours++;
      } else {
        nightHours++;
      }
      currentMs += 3600000;
    }
  }

  const baseParkingFee = dayHours * dayRate + nightHours * nightRate;
  let parkingFee = baseParkingFee;
  let dailyMaxCapApplied = false;

  const maxCap = pricing.dailyMaxRate || 120000;
  if (baseParkingFee > maxCap && maxCap > 0) {
    parkingFee = maxCap;
    dailyMaxCapApplied = true;
    processLogs.push(`[3. TỰ ĐỘNG TÍNH PHÍ] Áp dụng trần phí ngày tối đa: ${maxCap.toLocaleString("vi-VN")} đ (Tiết kiệm ${ (baseParkingFee - maxCap).toLocaleString("vi-VN") } đ).`);
  } else {
    processLogs.push(`[3. TỰ ĐỘNG TÍNH PHÍ] Phí ban ngày (${dayHours}h x ${dayRate.toLocaleString("vi-VN")}đ) + Phí ban đêm (${nightHours}h x ${nightRate.toLocaleString("vi-VN")}đ) = ${baseParkingFee.toLocaleString("vi-VN")} đ.`);
  }

  if (packageValid) {
    packageDiscount = parkingFee;
    parkingFee = 0;
    processLogs.push(`[3. TỰ ĐỘNG TÍNH PHÍ] Phí đỗ xe sau khi giảm trừ gói: 0 đ.`);
  }

  // 3. AUTO APPLY FINE RULES
  let overdueMinutes = 0;
  let overdueFine = 0;
  const fineRulesApplied: string[] = [];
  let fineReason: string | undefined;

  // Rule A: Over 24 hours continuous parking threshold (1440 mins)
  if (totalMinutes > 1440) {
    overdueMinutes = totalMinutes - 1440;
    overdueFine += pricing.overdueFineRate || 50000;
    fineReason = "Xe đỗ vượt quá thời gian tối đa 24 giờ.";
    fineRulesApplied.push("PHẠT_QUÁ_HẠN_24H");
    processLogs.push(`[4. TỰ ĐỘNG ÁP DỤNG QUY TẮC PHẠT] Cảnh báo: Vượt quá 24h (${overdueMinutes} phút quá hạn). Tự động cộng phí phạt: ${ (pricing.overdueFineRate || 50000).toLocaleString("vi-VN") } đ.`);
  } else {
    processLogs.push(`[4. TỰ ĐỘNG ÁP DỤNG QUY TẮC PHẠT] Không vi phạm quy tắc phạt đỗ xe.`);
  }

  const totalFee = parkingFee + overdueFine;
  processLogs.push(`[5. TỔNG KẾT] Phí đỗ xe: ${parkingFee.toLocaleString("vi-VN")} đ | Phí phạt: ${overdueFine.toLocaleString("vi-VN")} đ => Tổng thanh toán: ${totalFee.toLocaleString("vi-VN")} đ.`);

  return {
    totalMinutes,
    freeMinutes,
    billableMinutes,
    billableHours,
    dayHours,
    nightHours,
    hourlyRate: dayRate,
    overnightRate: nightRate,
    baseParkingFee,
    dailyMaxCapApplied,
    parkingFee,
    packageValid,
    packageName,
    packageExpiry,
    packageDiscount,
    overdueMinutes,
    overdueFine,
    fineReason,
    fineRulesApplied,
    totalFee,
    processLogs,
  };
}

export async function runAutomatedSystemProcess(params: {
  plate?: string;
  ownerUserId?: string;
  checkInAt: Date;
  checkOutAt: Date;
}): Promise<FeeBreakdown> {
  const pricing = await getActivePricingConfig();
  const pkgVal = await autoValidatePackage(params.plate, params.ownerUserId);
  return calculateParkingFee(params.checkInAt, params.checkOutAt, pricing, {
    valid: pkgVal.valid,
    packageName: pkgVal.packageName,
    packageExpiry: pkgVal.packageExpiry,
  });
}

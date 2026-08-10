import mongoose from "mongoose";
import type { HydratedDocument } from "mongoose";
import { Subscription, SubscriptionDocument } from "../models/Subscription.js";
import { SubscriptionPlan, SubscriptionPlanDocument } from "../models/SubscriptionPlan.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { Vehicle, VehicleDocument } from "../models/Vehicle.js";

type HydratedSubscription = HydratedDocument<SubscriptionDocument>;

/**
 * Input tối thiểu để tạo / tìm Vehicle khi đăng ký gói.
 */
export type VehicleRegistrationInput = {
  plate: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerAddress?: string;
  brand?: string;
  model?: string;
  color?: string;
  engineNo?: string;
  chassisNo?: string;
  year?: number;
};

export async function listPlans(): Promise<SubscriptionPlanDocument[]> {
  return SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
}

/**
 * Lấy tất cả plan (kể cả đã ẩn) — chỉ dành cho admin.
 */
export async function listAllPlans(): Promise<SubscriptionPlanDocument[]> {
  return SubscriptionPlan.find().sort({ price: 1 });
}

export async function createPlan(data: {
  name: string;
  description?: string;
  duration: "monthly" | "quarterly" | "yearly";
  durationDays: number;
  price: number;
  maxVehicles?: number;
}): Promise<SubscriptionPlanDocument> {
  return SubscriptionPlan.create({ ...data, isActive: true });
}

export async function updatePlan(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    price: number;
    maxVehicles: number;
    isActive: boolean;
  }>,
): Promise<SubscriptionPlanDocument> {
  const plan = await SubscriptionPlan.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" });
  if (!plan) {
    const err = new Error("Gói không tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return plan;
}

const PURCHASE_STATUS_IN_USE: SubscriptionDocument["status"][] = ["pending_payment", "active", "cancelled"];

/**
 * Mua gói mới — bắt buộc truyền vehicleId.
 * Quy tắc:
 *  - Mỗi xe chỉ có tối đa 1 gói "còn hiệu lực" (active/pending_payment/cancelled-chưa-hết-hạn).
 *  - 1 user có thể mua nhiều gói, mỗi gói gắn 1 xe khác nhau.
 *  - Vehicle phải thuộc user, status = "Đã đăng ký".
 */
export async function purchaseSubscription(params: {
  userId: string;
  planId: string;
  vehicleId: string;
  baseUrl?: string;
  frontendUrl?: string;
}): Promise<{ subscription: HydratedSubscription; payos?: Record<string, unknown> }> {
  const plan = await SubscriptionPlan.findById(params.planId);
  if (!plan || !plan.isActive) {
    const err = new Error("Gói không tồn tại hoặc đã ngừng.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (!params.vehicleId || !mongoose.Types.ObjectId.isValid(params.vehicleId)) {
    const err = new Error("Vui lòng chọn xe để mua gói.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  const vehicle = await Vehicle.findById(params.vehicleId).select("_id userId status plate");
  if (!vehicle) {
    const err = new Error("Xe không tồn tại. Vui lòng đăng ký xe trước khi mua gói.") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  if (vehicle.userId?.toString() !== params.userId) {
    const err = new Error("Xe này không thuộc tài khoản của bạn.") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  if (vehicle.status === "Blacklist" || vehicle.status === "Cần duyệt") {
    const err = new Error(
      `Phương tiện đang ở trạng thái "${vehicle.status}", không thể đăng ký vé tháng.`,
    ) as Error & { status: number };
    err.status = 400;
    throw err;
  }

  // Mỗi xe chỉ có 1 gói còn hiệu lực.
  const existingForVehicle = await Subscription.findOne({
    primaryVehicleId: vehicle._id,
    status: { $in: PURCHASE_STATUS_IN_USE },
    endDate: { $gt: new Date() },
  });
  if (existingForVehicle) {
    const err = new Error(
      `Xe ${vehicle.plate} đã được đăng ký vé tháng. Nếu muốn mua thêm gói tháng, vui lòng đăng ký xe khác.`,
    ) as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  let subscription;
  try {
    subscription = await Subscription.create({
      userId: new mongoose.Types.ObjectId(params.userId),
      planId: plan._id,
      planName: plan.name,
      primaryVehicleId: vehicle._id,
      startDate: now,
      endDate,
      status: "pending_payment",
      autoRenew: false,
      renewalCount: 0,
    });
  } catch (err: any) {
    if (err && err.code === 11000) {
      const e = new Error(
        `Xe ${vehicle.plate} đã có gói đang hoạt động hoặc đang chờ thanh toán.`,
      ) as Error & { status: number };
      e.status = 409;
      throw e;
    }
    throw err;
  }

  // Tạo transaction pending + link PayOS để thu tiền gói
  let payos: Record<string, unknown> | undefined;
  if (plan.price > 0) {
    const { createPayOSPayment } = await import("./payos.service.js");
    const baseUrl = params.baseUrl || process.env.API_URL || process.env.BASE_URL || "http://localhost:4000";
    const frontendUrl = params.frontendUrl || process.env.FRONTEND_URL || "http://localhost:3000";
    const payosResult = await createPayOSPayment({
      amount: plan.price,
      sessionId: String(subscription._id),
      label: "iPARK SUB",
      baseUrl,
      frontendUrl,
    });

    const transaction = await Transaction.create({
      userId: new mongoose.Types.ObjectId(params.userId),
      subscriptionId: subscription._id,
      method: "payos",
      amount: plan.price,
      status: "pending",
      note: `SUB-${String(subscription._id)}`,
      ...(payosResult.success
        ? {
            payosOrderCode: String(payosResult.orderCode),
            payosQrCode: payosResult.qrCode,
            payosCheckoutUrl: payosResult.checkoutUrl,
            payosAccountNumber: payosResult.accountNumber,
            payosAccountName: payosResult.accountName,
            payosBin: payosResult.bin,
          }
        : {}),
    });
    subscription.transactionId = transaction._id;
    await subscription.save();

    if (payosResult.success) {
      payos = {
        qrCode: payosResult.qrCode,
        checkoutUrl: payosResult.checkoutUrl,
        orderCode: payosResult.orderCode,
        amount: plan.price,
        accountNumber: payosResult.accountNumber,
        accountName: payosResult.accountName,
        bin: payosResult.bin,
        description: payosResult.description,
      };
    }
  } else {
    // Gói miễn phí → kích hoạt ngay
    await activateSubscription(subscription);
  }

  return { subscription, payos };
}

/**
 * Sinh mã thành viên duy nhất dạng "IPK-XXXXXX" (X: chữ/số).
 */
function genMemberCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `IPK-${suffix}`;
}

/**
 * Kích hoạt gói sau khi thanh toán thành công: set active + gán memberCode per-sub.
 * Idempotent: gọi lại trên gói đã active sẽ không đổi gì.
 */
export async function activateSubscription(sub: HydratedSubscription): Promise<HydratedSubscription> {
  if (sub.status === "active") return sub;
  sub.status = "active";

  if (!sub.memberCode) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = genMemberCode();
      try {
        sub.memberCode = code;
        sub.markModified("memberCode");
        await sub.save();
        break;
      } catch (err: any) {
        if (err.code === 11000) {
          // Trùng mã → unmark + thử mã khác.
          sub.unmarkModified("memberCode");
          (sub as any).memberCode = undefined;
          continue;
        }
        throw err;
      }
    }
  } else {
    await sub.save();
  }

  return sub;
}

/**
 * Xác thực mã thành viên: hợp lệ khi mã tồn tại VÀ sub của mã còn hiệu lực.
 * `plate` (optional): nếu có, đảm bảo plate khớp với primaryVehicle của sub.
 */
export async function verifyMemberCode(
  memberCode: string,
  plate?: string,
): Promise<{
  valid: boolean;
  userId?: string;
  subscriptionId?: string;
  plate?: string;
  message?: string;
}> {
  const code = memberCode.trim().toUpperCase();
  if (!code) return { valid: false, message: "Thiếu mã thành viên." };

  const sub = await Subscription.findOne({ memberCode: code });
  if (!sub) return { valid: false, message: "Mã thành viên không tồn tại." };

  const now = new Date();
  const stillEffective =
    (sub.status === "active" || sub.status === "cancelled") && sub.endDate > now;
  if (!stillEffective) {
    return { valid: false, message: "Mã thành viên không có gói còn hiệu lực." };
  }

  let vehicle: VehicleDocument | null = null;
  if (sub.primaryVehicleId) {
    vehicle = await Vehicle.findById(sub.primaryVehicleId).select("_id plate userId");
  }
  const subPlate = vehicle?.plate ? normalizePlate(vehicle.plate) : undefined;

  if (plate) {
    const normInput = normalizePlate(plate);
    if (!subPlate || subPlate !== normInput) {
      return {
        valid: false,
        message: `Mã thành viên này thuộc xe ${subPlate ?? "khác"}, không phải ${normInput}.`,
      };
    }
  }

  return {
    valid: true,
    userId: sub.userId.toString(),
    subscriptionId: sub._id.toString(),
    ...(subPlate ? { plate: subPlate } : {}),
  };
}

/**
 * Chủ động hỏi PayOS xem giao dịch mua gói đã thanh toán chưa, kích hoạt nếu rồi.
 */
export async function reconcileSubscriptionPayment(
  subscriptionId: string,
): Promise<SubscriptionDocument | null> {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) return null;

  const pending = await Transaction.find({
    subscriptionId: sub._id,
    status: "pending",
    payosOrderCode: { $exists: true, $ne: null },
  });

  const { checkPayOSPaymentStatus } = await import("./payos.service.js");
  for (const transaction of pending) {
    const result = await checkPayOSPaymentStatus(String(transaction.payosOrderCode));
    if (result.status !== "paid") continue;
    transaction.status = "paid";
    transaction.paidAt = new Date();
    await transaction.save();
    await applyPaidSubscriptionTransaction(transaction);
  }
  return Subscription.findById(subscriptionId);
}

export async function renewSubscription(
  subscriptionId: string,
  opts?: { baseUrl?: string; frontendUrl?: string },
): Promise<{ subscription: HydratedSubscription; payos?: Record<string, unknown> }> {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) {
    const err = new Error("Không tìm thấy gói đăng ký.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  const plan = await SubscriptionPlan.findById(sub.planId);
  if (!plan) {
    const err = new Error("Gói gốc không còn tồn tại.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (sub.status === "cancelled") {
    const err = new Error("Gói đã hủy, không thể gia hạn.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  const pendingRenew = await Transaction.findOne({
    subscriptionId: sub._id,
    status: "pending",
    note: { $regex: /^RENEW-/ },
  });
  if (pendingRenew) {
    const err = new Error("Đang có yêu cầu gia hạn chờ thanh toán. Hãy hoàn tất trước.") as Error & { status: number };
    err.status = 409;
    throw err;
  }

  if (plan.price <= 0) {
    const baseDate = sub.endDate > new Date() ? sub.endDate : new Date();
    sub.endDate = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    sub.status = "active";
    sub.renewalCount += 1;
    await sub.save();
    return { subscription: sub };
  }

  const { createPayOSPayment } = await import("./payos.service.js");
  const baseUrl = opts?.baseUrl || process.env.API_URL || process.env.BASE_URL || "http://localhost:4000";
  const frontendUrl = opts?.frontendUrl || process.env.FRONTEND_URL || "http://localhost:3000";
  const payosResult = await createPayOSPayment({
    amount: plan.price,
    sessionId: String(sub._id),
    label: "iPARK SUB-RN",
    baseUrl,
    frontendUrl,
  });

  const transaction = await Transaction.create({
    userId: sub.userId,
    subscriptionId: sub._id,
    method: "payos",
    amount: plan.price,
    status: "pending",
    note: `RENEW-${String(sub._id)}`,
    ...(payosResult.success
      ? {
          payosOrderCode: String(payosResult.orderCode),
          payosQrCode: payosResult.qrCode,
          payosCheckoutUrl: payosResult.checkoutUrl,
          payosAccountNumber: payosResult.accountNumber,
          payosAccountName: payosResult.accountName,
          payosBin: payosResult.bin,
        }
      : {}),
  });
  sub.transactionId = transaction._id;
  await sub.save();

  let payos: Record<string, unknown> | undefined;
  if (payosResult.success) {
    payos = {
      qrCode: payosResult.qrCode,
      checkoutUrl: payosResult.checkoutUrl,
      orderCode: payosResult.orderCode,
      amount: plan.price,
      accountNumber: payosResult.accountNumber,
      accountName: payosResult.accountName,
      bin: payosResult.bin,
      description: payosResult.description,
    };
  }
  return { subscription: sub, payos };
}

/**
 * Áp dụng giao dịch gói đã thanh toán:
 * - RENEW → cộng thêm số ngày gói.
 * - Mua mới → activate (set status active + sinh memberCode).
 */
export async function applyPaidSubscriptionTransaction(
  transaction: { subscriptionId?: mongoose.Types.ObjectId; note?: string },
): Promise<void> {
  if (!transaction.subscriptionId) return;
  const sub = await Subscription.findById(transaction.subscriptionId);
  if (!sub) return;

  if (transaction.note && /^RENEW-/.test(transaction.note)) {
    const plan = await SubscriptionPlan.findById(sub.planId);
    const days = plan?.durationDays ?? 30;
    const baseDate = sub.endDate > new Date() ? sub.endDate : new Date();
    sub.endDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    sub.status = "active";
    sub.renewalCount += 1;
    await sub.save();
  } else {
    await activateSubscription(sub);
  }
}

export async function cancelSubscription(subscriptionId: string): Promise<SubscriptionDocument | null> {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) {
    const err = new Error("Không tìm thấy gói đăng ký.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (sub.status === "pending_payment") {
    await Subscription.findByIdAndDelete(sub._id);
    console.log("[cancelSubscription] Deleted pending_payment subscription:", sub._id);
    return null;
  }

  if (sub.status !== "active") {
    const err = new Error("Gói không thể hủy ở trạng thái hiện tại.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  sub.status = "cancelled";
  await sub.save();
  return sub;
}

/**
 * Lấy QR PayOS của sub (đang pending_payment HOẶC active có RENEW pending).
 */
export async function getSubscriptionPaymentInfo(subscriptionId: string) {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) {
    const err = new Error("Không tìm thấy gói đăng ký.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  let transaction = await Transaction.findOne({
    subscriptionId: sub._id,
    status: "pending",
    payosOrderCode: { $exists: true, $ne: null },
  }).sort({ createdAt: -1 });

  const plan = await SubscriptionPlan.findById(sub.planId);

  const needsNewPayment = !transaction || !transaction.payosQrCode || !transaction.payosCheckoutUrl;
  if (needsNewPayment && plan && plan.price > 0) {
    console.log("[getSubscriptionPaymentInfo] Recreating PayOS payment for sub:", subscriptionId);
    try {
      const { createPayOSPayment } = await import("./payos.service.js");
      const baseUrl = process.env.API_URL || process.env.BASE_URL || "http://localhost:4000";
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

      const payosResult = await createPayOSPayment({
        amount: plan.price,
        sessionId: String(sub._id),
        label: transaction?.note?.startsWith("RENEW-") ? "iPARK SUB-RN" : "iPARK SUB",
        baseUrl,
        frontendUrl,
      });

      if (payosResult.success) {
        if (transaction) {
          transaction.payosOrderCode = String(payosResult.orderCode);
          transaction.payosQrCode = payosResult.qrCode;
          transaction.payosCheckoutUrl = payosResult.checkoutUrl;
          transaction.payosAccountNumber = payosResult.accountNumber;
          transaction.payosAccountName = payosResult.accountName;
          transaction.payosBin = payosResult.bin;
          await transaction.save();
        } else {
          transaction = await Transaction.create({
            userId: sub.userId,
            subscriptionId: sub._id,
            method: "payos",
            amount: plan.price,
            status: "pending",
            note: `SUB-${String(sub._id)}`,
            payosOrderCode: String(payosResult.orderCode),
            payosQrCode: payosResult.qrCode,
            payosCheckoutUrl: payosResult.checkoutUrl,
            payosAccountNumber: payosResult.accountNumber,
            payosAccountName: payosResult.accountName,
            payosBin: payosResult.bin,
          });
          sub.transactionId = transaction._id;
          await sub.save();
        }
      }
    } catch (err) {
      console.error("[getSubscriptionPaymentInfo] Failed to recreate PayOS payment:", err);
    }
  }

  if (!transaction) {
    return {
      amount: plan?.price ?? 0,
      orderCode: null,
      qrCode: null,
      checkoutUrl: null,
    };
  }

  return {
    amount: transaction.amount,
    orderCode: transaction.payosOrderCode,
    qrCode: transaction.payosQrCode,
    checkoutUrl: transaction.payosCheckoutUrl,
    accountNumber: transaction.payosAccountNumber ?? null,
    accountName: transaction.payosAccountName ?? null,
    bin: transaction.payosBin ?? null,
  };
}

/**
 * Chuẩn hoá biển số.
 */
export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/**
 * Tìm Vehicle theo biển số.
 */
export async function findVehicleByPlate(plate: string): Promise<VehicleDocument | null> {
  const normPlate = normalizePlate(plate);
  if (!normPlate) return null;
  return Vehicle.findOne({ plate: normPlate });
}

/**
 * Tìm hoặc tạo mới Vehicle theo biển số.
 */
export async function findOrCreateVehicle(
  input: VehicleRegistrationInput,
  options: { defaultUserId?: string } = {},
): Promise<VehicleDocument> {
  const normPlate = normalizePlate(input.plate);
  if (!normPlate) {
    const err = new Error("Biển số không hợp lệ.") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const PLACEHOLDER = "Chưa cập nhật";
  const isFilled = (v: unknown): boolean => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0 && v.trim() !== PLACEHOLDER;
    if (typeof v === "number") return Number.isFinite(v);
    return true;
  };
  const tryFill = <K extends keyof VehicleDocument>(target: VehicleDocument, key: K, value: VehicleDocument[K] | undefined) => {
    if (value == null) return;
    if (typeof value === "string" && value.trim() === "") return;
    if (!isFilled(target[key])) {
      (target as any)[key] = value;
    }
  };

  const existing = await Vehicle.findOne({ plate: normPlate });
  if (existing) {
    tryFill(existing, "ownerName", input.ownerName?.trim());
    tryFill(existing, "ownerPhone", input.ownerPhone?.trim());
    tryFill(existing, "ownerAddress", input.ownerAddress?.trim());
    tryFill(existing, "brand", input.brand?.trim());
    tryFill(existing, "model", input.model?.trim());
    tryFill(existing, "color", input.color?.trim());
    tryFill(existing, "engineNo", input.engineNo?.trim());
    tryFill(existing, "chassisNo", input.chassisNo?.trim());
    if (input.year != null && Number.isFinite(input.year)) {
      tryFill(existing, "year", input.year);
    }
    if (existing.isModified()) {
      await existing.save();
    }
    return existing;
  }
  return Vehicle.create({
    plate: normPlate,
    ownerName: input.ownerName?.trim() || "Chưa cập nhật",
    ownerPhone: input.ownerPhone?.trim(),
    ownerAddress: input.ownerAddress?.trim(),
    brand: input.brand?.trim(),
    model: input.model?.trim(),
    color: input.color?.trim(),
    year: input.year,
    engineNo: input.engineNo?.trim(),
    chassisNo: input.chassisNo?.trim(),
    vehicleType: "Ô tô",
    status: "Đã đăng ký",
    isCompanyVehicle: false,
    ...(options.defaultUserId ? { userId: options.defaultUserId } : {}),
  });
}

/**
 * Tìm sub còn hiệu lực theo biển số. Sub mới (per-vehicle) → 1 xe = 1 sub còn hiệu lực.
 * Lookup: Vehicle.findOne({plate}) → Subscription.findOne({primaryVehicleId}).
 */
export async function findActiveSubscriptionByPlate(plate: string): Promise<{
  userId: string;
  memberCode: string | null;
  planName: string;
  endDate: Date;
  subscriptionId: string;
  primaryVehicleId: string;
} | null> {
  const normPlate = normalizePlate(plate);
  if (!normPlate) return null;

  const vehicle = await Vehicle.findOne({ plate: normPlate }).select("_id");
  if (!vehicle) return null;

  const sub = await Subscription.findOne({
    primaryVehicleId: vehicle._id,
    status: { $in: ["active", "cancelled"] },
    endDate: { $gt: new Date() },
  });
  if (!sub) return null;

  return {
    userId: sub.userId.toString(),
    memberCode: sub.memberCode ?? null,
    planName: sub.planName,
    endDate: sub.endDate,
    subscriptionId: sub._id.toString(),
    primaryVehicleId: sub.primaryVehicleId.toString(),
  };
}

export async function getOwnerInfoFromPlate(
  plate: string,
  providedEmail?: string,
): Promise<{ name: string; email: string | undefined }> {
  const normPlate = normalizePlate(plate);
  if (!normPlate) return { name: "Khách vãng lai", email: undefined };

  const sub = await findActiveSubscriptionByPlate(normPlate);
  if (sub) {
    const user = await User.findById(sub.userId).select("name email");
    if (user) return { name: user.name, email: user.email };
  }

  const vehicle = await Vehicle.findOne({ plate: normPlate }).select("ownerName ownerEmail");
  if (vehicle) {
    return { name: vehicle.ownerName || "Khách vãng lai", email: vehicle.ownerEmail || providedEmail };
  }

  return { name: "Khách vãng lai", email: providedEmail };
}

export type SubscriptionDiscountResult = {
  discount: number;
  warn?: string;
};

/**
 * Kiểm tra quyền lợi gói cho biển số:
 * - User có sub active/cancelled-chưa-hết-hạn với primaryVehicleId = vehicleId của biển → 100%.
 * - User có sub khác (không phải xe này) → 0 + warn.
 * - User không có sub nào → 0.
 */
export async function checkSubscriptionDiscountForPlate(
  userId: string | mongoose.Types.ObjectId | undefined,
  plate: string,
): Promise<SubscriptionDiscountResult> {
  if (!userId) return { discount: 0 };
  const normPlate = normalizePlate(plate);
  if (!normPlate) return { discount: 0 };

  const vehicle = await Vehicle.findOne({ plate: normPlate }).select("_id");
  if (!vehicle) {
    const subAny = await Subscription.findOne({
      userId: new mongoose.Types.ObjectId(userId.toString()),
      status: { $in: ["active", "cancelled"] },
      endDate: { $gt: new Date() },
    });
    if (!subAny) return { discount: 0 };
    return {
      discount: 0,
      warn: `Biển số ${normPlate} chưa được đăng ký trong hệ thống. Vui lòng đăng ký xe để mua vé tháng cho biển này.`,
    };
  }

  const sub = await Subscription.findOne({
    userId: new mongoose.Types.ObjectId(userId.toString()),
    primaryVehicleId: vehicle._id,
    status: { $in: ["active", "cancelled"] },
    endDate: { $gt: new Date() },
  });
  if (sub) return { discount: 100 };

  const otherSub = await Subscription.findOne({
    userId: new mongoose.Types.ObjectId(userId.toString()),
    status: { $in: ["active", "cancelled"] },
    endDate: { $gt: new Date() },
  });
  if (otherSub) {
    return {
      discount: 0,
      warn: `Biển số ${normPlate} không thuộc gói "${otherSub.planName}". Xe sẽ được tính phí như khách vãng lai.`,
    };
  }

  return { discount: 0 };
}

export async function expireSubscriptions(): Promise<number> {
  const result = await Subscription.updateMany(
    { status: "active", endDate: { $lt: new Date() } },
    { $set: { status: "expired" } },
  );
  return result.modifiedCount;
}

/**
 * No-op — đã migrate sang schema mới (primaryVehicleId).
 */
export async function migrateLegacySubscriptionPlates(): Promise<{
  scanned: number;
  updated: number;
  vehiclesCreated: number;
}> {
  return { scanned: 0, updated: 0, vehiclesCreated: 0 };
}

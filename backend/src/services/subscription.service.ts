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

export async function purchaseSubscription(params: {
  userId: string;
  planId: string;
  baseUrl?: string;
  frontendUrl?: string;
}): Promise<{ subscription: HydratedSubscription; payos?: Record<string, unknown> }> {
  const plan = await SubscriptionPlan.findById(params.planId);
  if (!plan || !plan.isActive) {
    const err = new Error("Gói không tồn tại hoặc đã ngừng.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  // Chặn mua gói mới nếu user còn gói hiệu lực:
  // - active / pending_payment (đang chờ trả), hoặc
  // - cancelled nhưng chưa hết hạn (vẫn dùng được tới endDate).
  const existing = await Subscription.findOne({
    userId: new mongoose.Types.ObjectId(params.userId),
    $or: [
      { status: { $in: ["active", "pending_payment"] } },
      { status: "cancelled", endDate: { $gt: new Date() } },
    ],
  });
  if (existing) {
    const msg = existing.status === "pending_payment"
      ? "Bạn có gói đang chờ thanh toán. Hãy hoàn tất hoặc hủy trước."
      : "Bạn đã có gói còn hiệu lực. Hãy chờ hết hạn trước khi mua gói mới.";
    const err = new Error(msg) as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  // Gói tạo ở trạng thái "pending_payment" — chỉ active sau khi thanh toán PayOS.
  const subscription = await Subscription.create({
    userId: new mongoose.Types.ObjectId(params.userId),
    planId: plan._id,
    planName: plan.name,
    startDate: now,
    endDate,
    status: "pending_payment",
    autoRenew: false,
    renewalCount: 0,
  });

  // Tạo transaction pending + link PayOS để thu tiền gói
  let payos: Record<string, unknown> | undefined;
  if (plan.price > 0) {
    const { createPayOSPayment } = await import("./payos.service.js");
    const baseUrl = params.baseUrl || process.env.API_URL || process.env.BASE_URL || "http://localhost:4000";
    const frontendUrl = params.frontendUrl || process.env.FRONTEND_URL || "http://localhost:3000";
    const payosResult = await createPayOSPayment({
      amount: plan.price,
      sessionId: String(subscription._id), // dùng id gói làm mã đối chiếu
      label: "iPARK SUB",
      baseUrl,
      frontendUrl,
    });

    const transaction = await Transaction.create({
      userId: new mongoose.Types.ObjectId(params.userId),
      subscriptionId: subscription._id,
      method: "payos",
      gateway: "payos",
      amount: plan.price,
      status: "pending",
      content: `SUB-${String(subscription._id)}`,
      ...(payosResult.success ? { payosOrderCode: String(payosResult.orderCode) } : {}),
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
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ ký tự dễ nhầm
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `IPK-${suffix}`;
}

/**
 * Kích hoạt gói sau khi thanh toán thành công: set active + đảm bảo user có memberCode.
 * Idempotent: gọi lại trên gói đã active sẽ không đổi gì.
 */
export async function activateSubscription(sub: HydratedSubscription): Promise<HydratedSubscription> {
  if (sub.status === "active") return sub;
  sub.status = "active";
  await sub.save();

  // Gán memberCode cho user nếu chưa có (mã gắn với user, dùng lại cho các gói sau)
  const user = await User.findById(sub.userId);
  if (user && !user.memberCode) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = genMemberCode();
      try {
        user.memberCode = code;
        await user.save();
        break;
      } catch (err: any) {
        if (err.code === 11000) continue; // trùng → thử mã khác
        throw err;
      }
    }
  }
  return sub;
}

/**
 * Xác thực mã thành viên: hợp lệ khi mã tồn tại VÀ user còn gói đang hoạt động.
 * Thành viên được gửi xe miễn phí, không giới hạn xe, mọi biển số (param plate không còn ràng buộc).
 */
export async function verifyMemberCode(
  memberCode: string,
  _plate?: string,
): Promise<{ valid: boolean; userId?: string; message?: string }> {
  const code = memberCode.trim().toUpperCase();
  if (!code) return { valid: false, message: "Thiếu mã thành viên." };

  const user = await User.findOne({ memberCode: code });
  if (!user) return { valid: false, message: "Mã thành viên không tồn tại." };

  // Gói còn hiệu lực = active HOẶC cancelled nhưng chưa hết hạn (dùng tới endDate).
  const sub = await Subscription.findOne({
    userId: user._id,
    status: { $in: ["active", "cancelled"] },
    endDate: { $gt: new Date() },
  });
  if (!sub) {
    return { valid: false, message: "Mã thành viên không có gói còn hiệu lực." };
  }
  return { valid: true, userId: user._id.toString() };
}

/**
 * Chủ động hỏi PayOS xem giao dịch mua gói đã thanh toán chưa, kích hoạt nếu rồi.
 * Cần cho localhost nơi webhook không gọi tới server được.
 */
export async function reconcileSubscriptionPayment(
  subscriptionId: string,
): Promise<SubscriptionDocument | null> {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) return null;

  // Lấy mọi giao dịch gói pending có orderCode (mua mới hoặc gia hạn)
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
    transaction.gateway = "payos";
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

  // Chặn nếu đang có giao dịch gia hạn chờ thanh toán
  const pendingRenew = await Transaction.findOne({
    subscriptionId: sub._id,
    extensionType: "extend",
    status: "pending",
  });
  if (pendingRenew) {
    const err = new Error("Đang có yêu cầu gia hạn chờ thanh toán. Hãy hoàn tất trước.") as Error & { status: number };
    err.status = 409;
    throw err;
  }

  // Gia hạn miễn phí → cộng ngày ngay
  if (plan.price <= 0) {
    const baseDate = sub.endDate > new Date() ? sub.endDate : new Date();
    sub.endDate = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    sub.status = "active";
    sub.renewalCount += 1;
    await sub.save();
    return { subscription: sub };
  }

  // Có phí → tạo transaction "extend" pending + QR; CHỈ cộng ngày sau khi thanh toán.
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
    gateway: "payos",
    amount: plan.price,
    status: "pending",
    extensionType: "extend",
    content: `RENEW-${String(sub._id)}`,
    ...(payosResult.success ? { payosOrderCode: String(payosResult.orderCode) } : {}),
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
 * Áp dụng một giao dịch gói đã thanh toán: phân biệt mua mới (active + memberCode)
 * và gia hạn (cộng thêm số ngày của gói). Idempotent qua trạng thái transaction ở tầng gọi.
 */
export async function applyPaidSubscriptionTransaction(
  transaction: { subscriptionId?: mongoose.Types.ObjectId; extensionType?: string },
): Promise<void> {
  if (!transaction.subscriptionId) return;
  const sub = await Subscription.findById(transaction.subscriptionId);
  if (!sub) return;

  if (transaction.extensionType === "extend") {
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

export async function cancelSubscription(subscriptionId: string): Promise<SubscriptionDocument> {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) {
    const err = new Error("Không tìm thấy gói đăng ký.") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  if (sub.status !== "active") {
    const err = new Error("Gói không đang hoạt động.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  sub.status = "cancelled";
  await sub.save();
  return sub;
}

/**
 * Thành viên gửi xe MIỄN PHÍ: nếu user có gói đang hoạt động → giảm 100% phí (mọi biển số).
 */
export async function checkSubscriptionDiscount(
  userId?: mongoose.Types.ObjectId | string,
  _plate?: string,
): Promise<number> {
  if (!userId) return 0;

  const sub = await Subscription.findOne({
    userId: new mongoose.Types.ObjectId(userId.toString()),
    status: { $in: ["active", "cancelled"] },
    endDate: { $gt: new Date() },
  });

  return sub ? 100 : 0;
}

/**
 * Chuẩn hoá biển số: upper-case, trim, bỏ khoảng trắng và dấu gạch ngang.
 */
function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/**
 * Tìm Vehicle theo biển số (đã chuẩn hoá). Trả về null nếu chưa đăng ký.
 */
export async function findVehicleByPlate(plate: string): Promise<VehicleDocument | null> {
  const normPlate = normalizePlate(plate);
  if (!normPlate) return null;
  return Vehicle.findOne({ plate: normPlate });
}

/**
 * Tìm hoặc tạo mới Vehicle theo biển số. Dùng khi customer đăng ký xe cho gói.
 * - Nếu biển chưa có → tạo Vehicle mới với status = "Đã đăng ký".
 * - Nếu biển đã tồn tại → trả về luôn, KHÔNG ghi đè thông tin cũ (tránh mất data).
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
    // Vehicle đã tồn tại → fill các trường còn trống (hoặc đang "Chưa cập nhật")
    // từ dữ liệu mới. KHÔNG ghi đè dữ liệu đã có thật.
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
 * Tìm subscription còn hiệu lực có chứa biển số xe trong danh sách đăng ký.
 * Dùng khi xe vào bãi để tự động nhận diện thành viên mà không cần nhập mã.
 * Trả về thông tin userId + memberCode để set paymentStatus = fully_paid.
 *
 * Lookup: Vehicle → registeredVehicleIds.
 * Fallback: nếu sub vẫn dùng `registeredPlates` cũ (chưa migrate), vẫn match được.
 */
export async function findActiveSubscriptionByPlate(plate: string): Promise<{
  userId: string;
  memberCode: string | null;
  planName: string;
  endDate: Date;
} | null> {
  const normPlate = normalizePlate(plate);
  if (!normPlate) return null;

  const vehicle = await Vehicle.findOne({ plate: normPlate }).select("_id");
  const orClauses: Record<string, unknown>[] = [];
  if (vehicle) {
    orClauses.push({ registeredVehicleIds: vehicle._id });
  }
  // Fallback cho dữ liệu cũ.
  orClauses.push({ registeredPlates: normPlate });

  const sub = await Subscription.findOne({
    status: { $in: ["active", "cancelled"] },
    endDate: { $gt: new Date() },
    $or: orClauses,
  });
  if (!sub) return null;

  const user = await User.findById(sub.userId).select("memberCode");
  return {
    userId: sub.userId.toString(),
    memberCode: user?.memberCode ?? null,
    planName: sub.planName,
    endDate: sub.endDate,
  };
}

/**
 * Kết quả kiểm tra quyền lợi gói khi xe vào bãi.
 * - `discount` = % giảm giá (0 hoặc 100)
 * - `warn` = cảnh báo (nếu có gói nhưng biển không thuộc danh sách / vượt giới hạn)
 */
export type SubscriptionDiscountResult = {
  discount: number;
  warn?: string;
};

/**
 * Kiểm tra quyền lợi gói cho 1 biển số cụ thể:
 * - User không có gói / gói hết hạn → 0, không warn.
 * - User có gói còn hiệu lực, biển thuộc registeredVehicleIds VÀ không vượt maxVehicles → 100%.
 * - User có gói còn hiệu lực nhưng biển KHÔNG thuộc → 0% + warn.
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
    // Không tìm thấy Vehicle → plate chắc chắn không thuộc gói nào của user.
    // Vẫn check xem user có gói active không để trả warn.
    const subAny = await Subscription.findOne({
      userId: new mongoose.Types.ObjectId(userId.toString()),
      status: { $in: ["active", "cancelled"] },
      endDate: { $gt: new Date() },
    });
    if (!subAny) return { discount: 0 };
    return {
      discount: 0,
      warn: `Biển số ${normPlate} chưa được đăng ký trong hệ thống. Vui lòng kê khai xe cho gói "${subAny.planName}" để hưởng miễn phí.`,
    };
  }

  const sub = await Subscription.findOne({
    userId: new mongoose.Types.ObjectId(userId.toString()),
    status: { $in: ["active", "cancelled"] },
    endDate: { $gt: new Date() },
  });
  if (!sub) return { discount: 0 };

  const vehicleIds = (sub.registeredVehicleIds || []).map((id) => id.toString());
  const legacyPlates = (sub.registeredPlates || []).map(normalizePlate);
  if (vehicleIds.includes(vehicle._id.toString()) || legacyPlates.includes(normPlate)) {
    return { discount: 100 };
  }

  return {
    discount: 0,
    warn: `Biển số ${normPlate} không thuộc danh sách đăng ký của gói "${sub.planName}". Xe sẽ được tính phí như khách vãng lai.`,
  };
}

/**
 * Đăng ký 1 xe (Vehicle) cho subscription. Tự tìm Vehicle theo biển số, nếu chưa có
 * sẽ tạo mới từ `vehicleData`.
 */
export async function addVehicleToSubscription(
  subscriptionId: string,
  vehicleData: VehicleRegistrationInput,
  options: { requestingUserId?: string; requestingUserRole?: string } = {},
): Promise<SubscriptionDocument> {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) {
    const err = new Error("Không tìm thấy gói đăng ký.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (
    options.requestingUserRole !== "admin" &&
    options.requestingUserId &&
    sub.userId.toString() !== options.requestingUserId
  ) {
    const err = new Error("Bạn không có quyền sửa gói này.") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  if (!["active", "pending_payment", "cancelled"].includes(sub.status)) {
    const err = new Error("Gói đã hết hạn, không thể đăng ký xe.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  // Chuẩn hoá biển số + validate
  const normPlate = normalizePlate(vehicleData.plate);
  if (!normPlate) {
    const err = new Error("Biển số không hợp lệ.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  // Tìm hoặc tạo Vehicle. Nếu customer đăng ký gói cho chính mình thì set userId.
  const vehicle = await findOrCreateVehicle(
    { ...vehicleData, plate: normPlate },
    { defaultUserId: sub.userId.toString() },
  );

  const currentIds = (sub.registeredVehicleIds || []).map((id) => id.toString());
  if (!currentIds.includes(vehicle._id.toString())) {
    const plan = await SubscriptionPlan.findById(sub.planId);
    const max = plan?.maxVehicles ?? -1;
    if (max >= 0 && currentIds.length >= max) {
      const err = new Error(
        `Gói "${sub.planName}" chỉ cho phép đăng ký tối đa ${max} xe. Vui lòng xoá bớt xe cũ hoặc nâng cấp gói.`,
      ) as Error & { status: number };
      err.status = 409;
      throw err;
    }
    const newId = new mongoose.Types.ObjectId(vehicle._id.toString());
    // Gán mảng mới toàn ObjectId — setter sẽ dedupe + validate lại.
    sub.registeredVehicleIds = [
      ...currentIds.map((id) => new mongoose.Types.ObjectId(id)),
      newId,
    ] as unknown as typeof sub.registeredVehicleIds;
  }

  // Nếu sub còn dữ liệu cũ `registeredPlates`, đồng bộ luôn rồi sẽ migrate ở cron.
  const legacyPlates = (sub.registeredPlates || []).map(normalizePlate);
  if (!legacyPlates.includes(normPlate)) {
    sub.registeredPlates = [...legacyPlates, normPlate];
  }

  await sub.save();
  return sub;
}

/**
 * @deprecated Dùng addVehicleToSubscription. Giữ tạm để tương thích ngược.
 * Thêm 1 biển số vào danh sách đăng ký — không có thông tin chi tiết xe.
 */
export async function addPlateToSubscription(
  subscriptionId: string,
  plate: string,
  options: { requestingUserId?: string; requestingUserRole?: string } = {},
): Promise<SubscriptionDocument> {
  return addVehicleToSubscription(subscriptionId, { plate }, options);
}

/**
 * Xoá 1 xe (Vehicle) khỏi danh sách đăng ký. Idempotent.
 * Nhận `vehicleId` (ưu tiên) hoặc `plate` (fallback cho dữ liệu cũ).
 */
export async function removeVehicleFromSubscription(
  subscriptionId: string,
  identifier: string,
  options: { requestingUserId?: string; requestingUserRole?: string } = {},
): Promise<SubscriptionDocument> {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) {
    const err = new Error("Không tìm thấy gói đăng ký.") as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (
    options.requestingUserRole !== "admin" &&
    options.requestingUserId &&
    sub.userId.toString() !== options.requestingUserId
  ) {
    const err = new Error("Bạn không có quyền sửa gói này.") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  let resolvedVehicleId: string | null = null;
  let resolvedPlate: string | null = null;

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    resolvedVehicleId = identifier;
    const v = await Vehicle.findById(identifier).select("plate");
    resolvedPlate = v ? normalizePlate(v.plate) : null;
  } else {
    resolvedPlate = normalizePlate(identifier);
    const v = resolvedPlate ? await Vehicle.findOne({ plate: resolvedPlate }).select("_id") : null;
    resolvedVehicleId = v ? v._id.toString() : null;
  }

  if (resolvedVehicleId) {
    const ids = (sub.registeredVehicleIds || [])
      .map((id) => id.toString())
      .filter((id) => id !== resolvedVehicleId);
    sub.registeredVehicleIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  }
  if (resolvedPlate && sub.registeredPlates) {
    const plates = (sub.registeredPlates || []).map(normalizePlate).filter((p) => p !== resolvedPlate);
    sub.registeredPlates = plates.length > 0 ? plates : undefined;
  }

  await sub.save();
  return sub;
}

/**
 * @deprecated Dùng removeVehicleFromSubscription. Giữ tạm để tương thích ngược.
 */
export async function removePlateFromSubscription(
  subscriptionId: string,
  plate: string,
  options: { requestingUserId?: string; requestingUserRole?: string } = {},
): Promise<SubscriptionDocument> {
  return removeVehicleFromSubscription(subscriptionId, plate, options);
}

/**
 * Expire subscriptions past their endDate.
 */
export async function expireSubscriptions(): Promise<number> {
  const result = await Subscription.updateMany(
    { status: "active", endDate: { $lt: new Date() } },
    { $set: { status: "expired" } },
  );
  return result.modifiedCount;
}

/**
 * One-shot migration: chuyển `registeredPlates` (string[]) cũ sang
 * `registeredVehicleIds` (ObjectId[]) thông qua bảng Vehicle.
 *
 * - Tìm Subscription có `registeredPlates` còn dữ liệu.
 * - Với mỗi plate:
 *   - Nếu Vehicle với plate đó đã tồn tại → lấy _id.
 *   - Nếu chưa → tạo Vehicle mới, gắn userId của chủ gói.
 * - Push _id vào `registeredVehicleIds`.
 * - Xoá field `registeredPlates` khi migrate xong.
 *
 * Idempotent: chạy nhiều lần đều an toàn.
 */
export async function migrateLegacySubscriptionPlates(): Promise<{
  scanned: number;
  updated: number;
  vehiclesCreated: number;
}> {
  const subs = await Subscription.find({ registeredPlates: { $exists: true, $ne: [] } })
    .select("_id userId registeredPlates registeredVehicleIds");
  let updated = 0;
  let vehiclesCreated = 0;

  // Cache userId -> name để tránh query lặp lại.
  const userNameCache = new Map<string, string>();
  async function getUserName(userId: mongoose.Types.ObjectId): Promise<string> {
    const key = userId.toString();
    if (userNameCache.has(key)) return userNameCache.get(key)!;
    const user = await User.findById(userId).select("name");
    const name = user?.name?.trim() || "Chưa cập nhật";
    userNameCache.set(key, name);
    return name;
  }

  for (const sub of subs) {
    const legacyPlates: string[] = Array.isArray(sub.registeredPlates) ? sub.registeredPlates : [];
    if (legacyPlates.length === 0) continue;
    const newIds = new Set<string>((sub.registeredVehicleIds || []).map((id) => id.toString()));
    let changed = false;

    const ownerName = await getUserName(sub.userId);

    for (const plate of legacyPlates) {
      const normPlate = normalizePlate(plate);
      if (!normPlate) continue;
      let vehicle = await Vehicle.findOne({ plate: normPlate });
      if (!vehicle) {
        vehicle = await Vehicle.create({
          plate: normPlate,
          ownerName,
          vehicleType: "Ô tô",
          status: "Đã đăng ký",
          isCompanyVehicle: false,
          userId: sub.userId,
        });
        vehiclesCreated += 1;
      } else if (!vehicle.ownerName || vehicle.ownerName === "Chưa cập nhật") {
        // Backfill ownerName nếu Vehicle được tạo trước đó mà chưa có tên chủ.
        vehicle.ownerName = ownerName;
        await vehicle.save();
      }
      const idStr = vehicle._id.toString();
      if (!newIds.has(idStr)) {
        newIds.add(idStr);
        changed = true;
      }
    }

    if (changed) {
      sub.registeredVehicleIds = Array.from(newIds).map(
        (id) => new mongoose.Types.ObjectId(id),
      );
      // Field cũ giữ lại ở schema (select: false) để tránh leak; xoá khỏi document.
      sub.registeredPlates = undefined;
      await sub.save();
      updated += 1;
    } else if (sub.registeredPlates && sub.registeredPlates.length > 0) {
      // Không có id mới thêm nhưng vẫn dọn field cũ.
      sub.registeredPlates = undefined;
      await sub.save();
      updated += 1;
    }
  }

  return { scanned: subs.length, updated, vehiclesCreated };
}

/**
 * Backfill: với những Vehicle có ownerName rỗng / "Chưa cập nhật" mà thuộc
 * 1 subscription (qua `registeredVehicleIds` hoặc `registeredPlates` cũ) → gán
 * ownerName = tên của user chủ subscription đó.
 *
 * Idempotent. Chạy 1 lần sau khi đã migrate dữ liệu cũ.
 */
export async function backfillVehicleOwnerNames(): Promise<{ scanned: number; updated: number }> {
  const PLACEHOLDER = "Chưa cập nhật";
  const vehicles = await Vehicle.find({
    $or: [
      { ownerName: { $exists: false } },
      { ownerName: "" },
      { ownerName: PLACEHOLDER },
    ],
  }).select("_id plate ownerName userId");
  if (vehicles.length === 0) return { scanned: 0, updated: 0 };

  const userNameCache = new Map<string, string>();
  async function getUserName(userId: mongoose.Types.ObjectId | string | undefined): Promise<string | null> {
    if (!userId) return null;
    const key = userId.toString();
    if (userNameCache.has(key)) return userNameCache.get(key)!;
    const u = await User.findById(userId).select("name");
    const name = u?.name?.trim() || null;
    if (name) userNameCache.set(key, name);
    return name;
  }

  let updated = 0;
  for (const v of vehicles) {
    // Ưu tiên userId trực tiếp trên Vehicle.
    let name = await getUserName(v.userId);
    if (!name) {
      // Tìm qua Subscription.registeredVehicleIds (kèm fallback registeredPlates).
      const sub = await Subscription.findOne({
        $or: [
          { registeredVehicleIds: v._id },
          { registeredPlates: v.plate },
        ],
      }).select("userId");
      if (sub) {
        name = await getUserName(sub.userId);
      }
    }
    if (name) {
      v.ownerName = name;
      if (!v.userId) {
        // cố gắng set userId từ subscription.
        const sub = await Subscription.findOne({
          $or: [
            { registeredVehicleIds: v._id },
            { registeredPlates: v.plate },
          ],
        }).select("userId");
        if (sub) v.userId = sub.userId;
      }
      await v.save();
      updated += 1;
    }
  }
  return { scanned: vehicles.length, updated };
}

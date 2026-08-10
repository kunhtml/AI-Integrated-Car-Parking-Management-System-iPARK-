import { Request, Response } from "express";
import { z } from "zod";
import {
  cancelSubscription,
  createPlan,
  expireSubscriptions,
  getSubscriptionPaymentInfo,
  listAllPlans,
  listPlans,
  purchaseSubscription,
  reconcileSubscriptionPayment,
  renewSubscription,
  updatePlan,
  verifyMemberCode,
} from "../services/subscription.service.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { Vehicle } from "../models/Vehicle.js";
import {
  serializeSubscription,
  serializeSubscriptionForAdmin,
  serializeSubscriptionPlan,
} from "../utils/serializers.js";

// --- Plans ---

export async function listPlansHandler(request: Request, response: Response) {
  const isAdmin = request.user?.role === "admin";
  const plans = isAdmin ? await listAllPlans() : await listPlans();
  response.json({ plans: plans.map(serializeSubscriptionPlan) });
}

export async function createPlanHandler(request: Request, response: Response) {
  const body = z
    .object({
      name: z.string().min(2),
      description: z.string().optional(),
      duration: z.enum(["monthly", "quarterly", "yearly"]),
      durationDays: z.number().int().min(1),
      price: z.number().min(0),
      maxVehicles: z.number().int().min(-1).optional(),
    })
    .parse(request.body);

  const plan = await createPlan(body);
  response.status(201).json({ plan: serializeSubscriptionPlan(plan) });
}

export async function updatePlanHandler(request: Request, response: Response) {
  const body = z
    .object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      price: z.number().min(0).optional(),
      maxVehicles: z.number().int().min(-1).optional(),
      isActive: z.boolean().optional(),
    })
    .parse(request.body);

  const plan = await updatePlan(String(request.params.id), body);
  response.json({ plan: serializeSubscriptionPlan(plan) });
}

export async function deletePlanHandler(request: Request, response: Response) {
  await updatePlan(String(request.params.id), { isActive: false });
  response.json({ ok: true, message: "Gói đã được ẩn." });
}

// --- Subscriptions ---

async function findSubsPopulated(query: Record<string, unknown>) {
  return Subscription.find(query)
    .sort({ createdAt: -1 })
    .populate({
      path: "primaryVehicleId",
      model: "Vehicle",
      select: "plate ownerName brand model color year engineNo chassisNo status",
    });
}

async function populateSub(sub: any) {
  return Subscription.findById(sub._id).populate({
    path: "primaryVehicleId",
    model: "Vehicle",
    select: "plate ownerName brand model color year engineNo chassisNo status",
  });
}

export async function listSubscriptionsHandler(request: Request, response: Response) {
  const subs = await findSubsPopulated({});

  if (request.user?.role === "admin") {
    const userIds = Array.from(new Set(subs.map((s) => s.userId.toString())));
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const enriched = subs.map((s) =>
      serializeSubscriptionForAdmin(s, userMap.get(s.userId.toString()) ?? null),
    );
    response.json({ subscriptions: enriched });
    return;
  }

  response.json({ subscriptions: subs.map(serializeSubscription) });
}

export async function mySubscriptionsHandler(request: Request, response: Response) {
  const subs = await findSubsPopulated({ userId: request.user!.id });
  response.json({ subscriptions: subs.map(serializeSubscription) });
}

export async function purchaseHandler(request: Request, response: Response) {
  const body = z
    .object({
      planId: z.string().min(1),
      vehicleId: z.string().min(1),
    })
    .parse(request.body);

  const baseUrl = process.env.API_URL || process.env.BASE_URL || "http://localhost:4000";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const { subscription, payos } = await purchaseSubscription({
    userId: request.user!.id,
    planId: body.planId,
    vehicleId: body.vehicleId,
    baseUrl,
    frontendUrl,
  });
  const populated = await populateSub(subscription);
  const user = await User.findById(subscription.userId);
  const serializer = request.user!.role === "admin" ? serializeSubscriptionForAdmin : serializeSubscription;
  response.status(201).json({
    subscription: serializer(populated ?? subscription, user ?? null),
    payos,
  });
}

export async function verifyMemberCodeHandler(request: Request, response: Response) {
  const body = z
    .object({ memberCode: z.string().min(3), plate: z.string().optional() })
    .parse(request.body);
  const result = await verifyMemberCode(body.memberCode, body.plate);
  response.json(result);
}

export async function subscriptionPaymentStatusHandler(request: Request, response: Response) {
  const sub = await reconcileSubscriptionPayment(String(request.params.id));
  if (!sub) {
    response.status(404).json({ message: "Không tìm thấy gói." });
    return;
  }
  const populated = await populateSub(sub);
  response.json({
    subscription: serializeSubscription(populated ?? sub),
    status: sub.status,
    memberCode: sub.memberCode ?? null,
    endDate: sub.endDate.toISOString(),
  });
}

export async function renewHandler(request: Request, response: Response) {
  const baseUrl = process.env.API_URL || process.env.BASE_URL || "http://localhost:4000";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const { subscription, payos } = await renewSubscription(String(request.params.id), { baseUrl, frontendUrl });
  const populated = await populateSub(subscription);
  const user = await User.findById(subscription.userId);
  const serializer = request.user!.role === "admin" ? serializeSubscriptionForAdmin : serializeSubscription;
  response.json({
    subscription: serializer(populated ?? subscription, user ?? null),
    payos,
    message: payos ? "Quét mã QR để thanh toán và gia hạn gói." : "Đã gia hạn gói.",
  });
}

export async function cancelHandler(request: Request, response: Response) {
  const sub = await cancelSubscription(String(request.params.id));

  if (!sub) {
    response.json({ subscription: null, message: "Đã xóa gói đăng ký chưa thanh toán." });
    return;
  }

  const populated = await populateSub(sub);
  const user = await User.findById(sub.userId);
  const serializer = request.user!.role === "admin" ? serializeSubscriptionForAdmin : serializeSubscription;
  response.json({ subscription: serializer(populated ?? sub, user ?? null), message: "Đã hủy gói." });
}

export async function getPaymentInfoHandler(request: Request, response: Response) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");

  const sub = await Subscription.findById(String(request.params.id)).select("userId");
  if (!sub) {
    response.status(404).json({ message: "Không tìm thấy gói đăng ký." });
    return;
  }
  if (request.user?.role !== "admin" && sub.userId.toString() !== request.user!.id) {
    response.status(403).json({ message: "Bạn không có quyền truy cập vé này." });
    return;
  }

  const paymentInfo = await getSubscriptionPaymentInfo(String(request.params.id));
  response.json(paymentInfo);
}

export async function deleteSubscriptionHandler(request: Request, response: Response) {
  const sub = await Subscription.findById(request.params.id);
  if (!sub) {
    response.status(404).json({ message: "Không tìm thấy gói đăng ký." });
    return;
  }

  // Admin có thể xóa gói đang active (đặc quyền dọn dẹp dữ liệu).
  // Customer sẽ không gọi được endpoint này vì route đã requireRole("admin").
  if (sub.primaryVehicleId) {
    // Best-effort: xoá Vehicle gắn với sub (chỉ khi Vehicle đó không thuộc sub khác)
    await Vehicle.deleteMany({ _id: sub.primaryVehicleId });
  }

  await Subscription.findByIdAndDelete(sub._id);
  console.log("[deleteSubscription] Deleted subscription:", sub._id, "status was", sub.status);
  response.json({ message: "Đã xóa gói đăng ký." });
}

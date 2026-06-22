import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { MembershipPackage } from "../models/MembershipPackage.js";
import { serializeMembershipPackage } from "../utils/serializers.js";

const defaultMembershipPackages = [
  {
    id: "daily-commuter",
    name: "Daily Commuter",
    code: "DAILY-01",
    billingCycle: "Daily",
    price: 50000,
    durationDays: 1,
    subscriberCount: 0,
    renewalRate: 0,
    status: "Active",
    features: ["Daily package fallback", "Single-day validity", "Auto apply after payment"],
    note: "Aligned with BR-05 default daily package when no valid membership exists.",
  },
  {
    id: "business-flex",
    name: "Business Flex",
    code: "FLEX-02",
    billingCycle: "Monthly",
    price: 1200000,
    durationDays: 30,
    subscriberCount: 0,
    renewalRate: 0,
    status: "Active",
    features: ["Monthly parking", "Member vehicle benefits", "Renewal management"],
    note: "Supports FT-03 subscription management and UC28.",
  },
  {
    id: "premium-quarterly",
    name: "Premium Quarterly",
    code: "PREMIUM-03",
    billingCycle: "Quarterly",
    price: 3200000,
    durationDays: 90,
    subscriberCount: 0,
    renewalRate: 0,
    status: "Draft",
    features: ["Quarterly validity", "Priority member tier", "Corporate partner ready"],
    note: "Draft tier for Add Custom Tier flow in P-14.",
  },
];

const packageSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(40),
  billingCycle: z.enum(["Daily", "Monthly", "Quarterly", "Custom"]),
  price: z.number().min(0),
  durationDays: z.number().int().min(1),
  subscriberCount: z.number().int().min(0).optional(),
  renewalRate: z.number().min(0).max(100).optional(),
  status: z.enum(["Active", "Draft", "Paused"]),
  features: z.array(z.string()).default([]),
  note: z.string().optional().default(""),
});

function actorId(request: Request) {
  return request.user?.id && mongoose.Types.ObjectId.isValid(request.user.id) ? request.user.id : undefined;
}

export async function listMembershipPackages(request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ packages: defaultMembershipPackages });
    return;
  }

  const status = typeof request.query.status === "string" ? request.query.status : undefined;
  const q = typeof request.query.q === "string" ? request.query.q.trim() : "";
  const criteria: Record<string, unknown> = {};

  if (status && status !== "All") criteria.status = status;
  if (q) {
    criteria.$or = [
      { name: { $regex: q, $options: "i" } },
      { code: { $regex: q, $options: "i" } },
      { billingCycle: { $regex: q, $options: "i" } },
    ];
  }

  const packages = await MembershipPackage.find(criteria).sort({ updatedAt: -1 }).limit(200);
  response.json({ packages: packages.map(serializeMembershipPackage) });
}

export async function createMembershipPackage(request: Request, response: Response) {
  const body = packageSchema.parse(request.body);

  if (mongoose.connection.readyState !== 1) {
    response.status(201).json({
      package: { id: `temp-${Date.now()}`, ...body },
      message: "Chưa kết nối DB, package được trả về ở chế độ tạm.",
    });
    return;
  }

  const exists = await MembershipPackage.findOne({ code: body.code.toUpperCase() });
  if (exists) {
    response.status(409).json({ message: "Package code đã tồn tại." });
    return;
  }

  const pkg = await MembershipPackage.create({
    ...body,
    code: body.code.toUpperCase(),
    createdBy: actorId(request),
    updatedBy: actorId(request),
  });

  response.status(201).json({ package: serializeMembershipPackage(pkg), message: "Đã tạo membership package." });
}

export async function updateMembershipPackage(request: Request, response: Response) {
  const body = packageSchema.partial().parse(request.body);

  if (mongoose.connection.readyState !== 1) {
    response.json({
      package: {
        id: request.params.id,
        ...body,
      },
      message: "Chưa kết nối DB, package settings được cập nhật ở chế độ tạm.",
    });
    return;
  }

  const update = {
    ...body,
    ...(body.code ? { code: body.code.toUpperCase() } : {}),
    updatedBy: actorId(request),
  };

  const pkg = await MembershipPackage.findByIdAndUpdate(request.params.id, update, { new: true });
  if (!pkg) {
    response.status(404).json({ message: "Không tìm thấy membership package." });
    return;
  }

  response.json({ package: serializeMembershipPackage(pkg), message: "Package settings are updated." });
}

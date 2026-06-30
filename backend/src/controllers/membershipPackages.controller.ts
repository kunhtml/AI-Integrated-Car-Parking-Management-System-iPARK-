import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { MembershipPackage } from "../models/MembershipPackage.js";
import { serializeMembershipPackage } from "../utils/serializers.js";

const packageSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(40),
  billingCycle: z.enum(["Daily", "Monthly", "Quarterly", "Yearly", "Custom"]),
  price: z.number().min(0),
  durationDays: z.number().int().min(1),
  maxPlates: z.number().int().min(-1).default(-1),
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
    response.json({ packages: [] });
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

  const packages = await MembershipPackage.find(criteria).sort({ createdAt: -1 }).limit(200);
  response.json({ packages: packages.map(serializeMembershipPackage) });
}

export async function createMembershipPackage(request: Request, response: Response) {
  const body = packageSchema.parse(request.body);

  if (mongoose.connection.readyState !== 1) {
    response.status(201).json({
      package: { id: `temp-${Date.now()}`, createdAt: new Date().toISOString(), ...body },
      message: "Chưa kết nối DB, gói được tạo tạm trên giao diện.",
    });
    return;
  }

  const exists = await MembershipPackage.findOne({ code: body.code.toUpperCase() });
  if (exists) {
    response.status(409).json({ message: "Mã gói đã tồn tại." });
    return;
  }

  const pkg = await MembershipPackage.create({
    ...body,
    code: body.code.toUpperCase(),
    createdBy: actorId(request),
    updatedBy: actorId(request),
  });

  response.status(201).json({ package: serializeMembershipPackage(pkg), message: "Đã tạo gói đăng ký." });
}

export async function updateMembershipPackage(request: Request, response: Response) {
  const body = packageSchema.partial().parse(request.body);

  if (mongoose.connection.readyState !== 1) {
    response.json({
      package: {
        id: request.params.id,
        ...body,
      },
      message: "Chưa kết nối DB, gói được cập nhật tạm trên giao diện.",
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
    response.status(404).json({ message: "Không tìm thấy gói đăng ký." });
    return;
  }

  response.json({ package: serializeMembershipPackage(pkg), message: "Đã cập nhật gói đăng ký." });
}

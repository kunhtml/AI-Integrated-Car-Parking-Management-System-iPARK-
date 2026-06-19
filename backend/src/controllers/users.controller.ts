import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { serializeUser } from "../utils/serializers.js";

const roleSchema = z.enum(["admin", "staff", "customer"]);
const statusSchema = z.enum(["Đang hoạt động", "Đã khóa"]);

function normalizeRoleFilter(role?: unknown) {
  if (!role) return undefined;
  const parsed = roleSchema.safeParse(String(role));
  return parsed.success ? parsed.data : undefined;
}

export async function listUsers(request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ users: [] });
    return;
  }

  const role = normalizeRoleFilter(request.query.role);
  const criteria = role ? { role } : {};
  const users = await User.find(criteria).sort({ createdAt: -1 }).limit(200);
  response.json({ users: users.map(serializeUser) });
}

export async function createStaffAccount(request: Request, response: Response) {
  const body = z
    .object({
      name: z.string().min(1),
      email: z.email(),
      password: z.string().min(6),
      status: statusSchema.default("Đang hoạt động"),
    })
    .parse(request.body);

  if (mongoose.connection.readyState !== 1) {
    response.status(503).json({ message: "Chưa kết nối DB nên không thể tạo tài khoản nhân viên." });
    return;
  }

  const email = body.email.toLowerCase();
  const exists = await User.findOne({ email });
  if (exists) {
    response.status(409).json({ message: "Email đã tồn tại." });
    return;
  }

  const user = await User.create({
    name: body.name,
    email,
    passwordHash: await bcrypt.hash(body.password, 12),
    provider: "local",
    role: "staff",
    status: body.status,
  });

  response.status(201).json({ user: serializeUser(user), message: "Đã tạo tài khoản nhân viên." });
}

export async function updateUser(request: Request, response: Response) {
  const body = z
    .object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      role: roleSchema.optional(),
      status: statusSchema.optional(),
    })
    .parse(request.body);

  if (mongoose.connection.readyState !== 1) {
    response.status(503).json({ message: "Chưa kết nối DB nên không thể cập nhật người dùng." });
    return;
  }

  const updated = await User.findByIdAndUpdate(
    body.id,
    {
      ...(body.name ? { name: body.name } : {}),
      ...(body.role ? { role: body.role } : {}),
      ...(body.status ? { status: body.status } : {}),
    },
    { new: true },
  );

  if (!updated) {
    response.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }

  response.json({ user: serializeUser(updated), message: "Đã cập nhật người dùng." });
}

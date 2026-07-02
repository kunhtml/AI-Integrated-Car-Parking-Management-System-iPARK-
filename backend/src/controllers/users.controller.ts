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

export async function createUser(request: Request, response: Response) {
  const body = z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      role: roleSchema.default("customer"),
      status: statusSchema.default("Đang hoạt động"),
      phone: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      gender: z.string().optional(),
      dob: z.string().optional(),
      idCardNumber: z.string().optional(),
      idCardIssueDate: z.string().optional(),
      idCardExpiryDate: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      district: z.string().optional(),
      emergencyContactName: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
      company: z.string().optional(),
      taxId: z.string().optional(),
    })
    .parse(request.body);

  if (mongoose.connection.readyState !== 1) {
    response.status(503).json({ message: "Chưa kết nối DB nên không thể tạo tài khoản." });
    return;
  }

  const email = body.email.toLowerCase();
  const exists = await User.findOne({ email });
  if (exists) {
    response.status(409).json({ message: "Email đã tồn tại trong hệ thống." });
    return;
  }

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await User.create({
    name: body.name,
    email,
    passwordHash,
    role: body.role,
    status: body.status,
    phone: body.phone,
    firstName: body.firstName,
    lastName: body.lastName,
    gender: body.gender,
    dob: body.dob,
    idCardNumber: body.idCardNumber,
    idCardIssueDate: body.idCardIssueDate,
    idCardExpiryDate: body.idCardExpiryDate,
    address: body.address,
    city: body.city,
    district: body.district,
    emergencyContactName: body.emergencyContactName,
    emergencyContactPhone: body.emergencyContactPhone,
    company: body.company,
    taxId: body.taxId,
    provider: "credentials",
  });

  response.status(201).json({ user: serializeUser(user), message: "Đã tạo tài khoản thành công." });
}

export async function createStaffAccount(request: Request, response: Response) {
  return createUser(request, response);
}

export async function updateUser(request: Request, response: Response) {
  const body = z
    .object({
      id: z.string().min(1),
      name: z.string().optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      role: roleSchema.optional(),
      status: statusSchema.optional(),
      phone: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      gender: z.string().optional(),
      dob: z.string().optional(),
      idCardNumber: z.string().optional(),
      idCardIssueDate: z.string().optional(),
      idCardExpiryDate: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      district: z.string().optional(),
      emergencyContactName: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
      company: z.string().optional(),
      taxId: z.string().optional(),
    })
    .parse(request.body);

  if (mongoose.connection.readyState !== 1) {
    response.status(503).json({ message: "Chưa kết nối DB nên không thể cập nhật người dùng." });
    return;
  }

  const updateData: Record<string, any> = { ...body };
  delete updateData.id;

  if (body.password) {
    updateData.passwordHash = await bcrypt.hash(body.password, 12);
    delete updateData.password;
  }

  const updated = await User.findByIdAndUpdate(body.id, { $set: updateData }, { new: true });

  if (!updated) {
    response.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }

  response.json({ user: serializeUser(updated), message: "Đã cập nhật tài khoản thành công." });
}

export async function deleteUser(request: Request, response: Response) {
  const { id } = request.params;
  if (!id) {
    response.status(400).json({ message: "Thiếu ID người dùng." });
    return;
  }

  if (mongoose.connection.readyState !== 1) {
    response.status(503).json({ message: "Chưa kết nối DB nên không thể xóa người dùng." });
    return;
  }

  const deleted = await User.findByIdAndDelete(id);
  if (!deleted) {
    response.status(404).json({ message: "Không tìm thấy người dùng để xóa." });
    return;
  }

  response.json({ message: "Đã xóa tài khoản thành công." });
}

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, UserRole } from "../models/User.js";
import { serializeUser } from "../utils/serializers.js";

// Vai trò mà mỗi actor được phép quản lý.
function manageableRoles(actorRole?: string): UserRole[] {
  if (actorRole === "admin") return ["staff", "customer"];
  if (actorRole === "staff") return ["customer"];
  return [];
}

export async function listUsers(request: Request, response: Response) {
  const roles = manageableRoles(request.user?.role);
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";

  const criteria: Record<string, unknown> = { role: { $in: roles } };
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");
    criteria.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  const users = await User.find(criteria).sort({ createdAt: -1 }).limit(200);
  response.json({ users: users.map(serializeUser) });
}

// Các field hồ sơ dùng chung cho create + update (ngoài name/email/role/status/password).
const profileFields = {
  phone: z.string().trim().optional(),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  birthDate: z.string().optional(),
  idCardNumber: z.string().trim().optional(),
  idCardIssuedAt: z.string().optional(),
  idCardExpiry: z.string().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  district: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
  company: z.string().trim().optional(),
  taxCode: z.string().trim().optional(),
};

// Chuyển field hồ sơ từ body sang dạng lưu DB (parse ngày).
function profilePayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const key of Object.keys(profileFields)) {
    if (body[key] === undefined) continue;
    if (key === "birthDate" || key === "idCardIssuedAt" || key === "idCardExpiry") {
      payload[key] = body[key] ? new Date(body[key] as string) : undefined;
    } else {
      payload[key] = body[key];
    }
  }
  return payload;
}

export async function createUser(request: Request, response: Response) {
  const allowed = manageableRoles(request.user?.role);
  const body = z
    .object({
      name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự"),
      email: z.string().email("Email không hợp lệ"),
      password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
      role: z.enum(["admin", "staff", "customer"]),
      status: z.enum(["Đang hoạt động", "Đã khóa"]).optional(),
      ...profileFields,
    })
    .parse(request.body);

  if (!allowed.includes(body.role)) {
    response.status(403).json({ message: "Bạn không có quyền tạo tài khoản với vai trò này." });
    return;
  }

  const email = body.email.toLowerCase();
  const existed = await User.findOne({ email });
  if (existed) {
    response.status(409).json({ message: "Email đã tồn tại." });
    return;
  }

  if (body.phone) {
    const phoneExisted = await User.findOne({ phone: body.phone });
    if (phoneExisted) {
      response.status(409).json({ message: "Số điện thoại đã được sử dụng." });
      return;
    }
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const profile = profilePayload(body as Record<string, unknown>);
  // Tự suy ra first/last name nếu không nhập.
  if (profile.firstName === undefined && profile.lastName === undefined) {
    const nameParts = body.name.trim().split(/\s+/);
    profile.lastName = nameParts.pop() || "";
    profile.firstName = nameParts.join(" ") || "";
  }

  const user = await User.create({
    name: body.name,
    email,
    passwordHash,
    role: body.role,
    status: body.status ?? "Đang hoạt động",
    isVerified: true,
    ...profile,
  });

  response.status(201).json({ user: serializeUser(user) });
}

export async function updateUser(request: Request, response: Response) {
  const allowed = manageableRoles(request.user?.role);
  const body = z
    .object({
      id: z.string().min(1),
      name: z.string().min(2).optional(),
      role: z.enum(["admin", "staff", "customer"]).optional(),
      status: z.enum(["Đang hoạt động", "Đã khóa"]).optional(),
      password: z.string().min(6).optional(),
      ...profileFields,
    })
    .parse(request.body);

  const target = await User.findById(body.id);
  if (!target) {
    response.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }

  // Chỉ được sửa tài khoản thuộc nhóm vai trò mình quản lý.
  if (!allowed.includes(target.role)) {
    response.status(403).json({ message: "Bạn không có quyền sửa tài khoản này." });
    return;
  }

  // Nếu đổi vai trò, vai trò mới cũng phải nằm trong nhóm cho phép.
  if (body.role && !allowed.includes(body.role)) {
    response.status(403).json({ message: "Bạn không có quyền gán vai trò này." });
    return;
  }

  if (body.name !== undefined) target.name = body.name;
  if (body.role !== undefined) target.role = body.role;
  if (body.status !== undefined) target.status = body.status;
  if (body.password) target.passwordHash = await bcrypt.hash(body.password, 12);

  const profile = profilePayload(body as Record<string, unknown>);
  Object.assign(target, profile);
  await target.save();

  response.json({ user: serializeUser(target) });
}

export async function deleteUser(request: Request, response: Response) {
  const allowed = manageableRoles(request.user?.role);
  const id = request.params.id;

  const target = await User.findById(id);
  if (!target) {
    response.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }

  if (!allowed.includes(target.role)) {
    response.status(403).json({ message: "Bạn không có quyền xóa tài khoản này." });
    return;
  }

  if (request.user?.id === id) {
    response.status(400).json({ message: "Không thể xóa chính tài khoản của bạn." });
    return;
  }

  await target.deleteOne();
  response.json({ id });
}

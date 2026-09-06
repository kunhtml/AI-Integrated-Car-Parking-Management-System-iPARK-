import { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, UserRole } from "../models/User.js";
import { ShiftSchedule } from "../models/ShiftSchedule.js";
import { createAuditLog } from "../services/auditLog.service.js";
import { revokeUserSessions } from "../services/session.service.js";
import { serializeUser } from "../utils/serializers.js";
import { passwordSchema } from "../validations/password.validation.js";

// Vai trò mà mỗi actor được phép quản lý.
function manageableRoles(actorRole?: string): UserRole[] {
  if (actorRole === "admin" || actorRole === "manager")
    return ["staff", "customer"];
  if (actorRole === "staff") return ["customer"];
  return [];
}

export async function listUsers(request: Request, response: Response) {
  const roles = manageableRoles(request.user?.role);
  const search =
    typeof request.query.search === "string" ? request.query.search.trim() : "";
  const requestedRole =
    typeof request.query.role === "string" ? request.query.role : undefined;
  const page = Math.max(
    1,
    Number.parseInt(
      typeof request.query.page === "string" ? request.query.page : "1",
      10,
    ) || 1,
  );
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(
        typeof request.query.limit === "string" ? request.query.limit : "50",
        10,
      ) || 50,
    ),
  );
  const sort: Record<string, 1 | -1> =
    request.query.sort === "name"
      ? { name: 1, _id: 1 }
      : { createdAt: -1, _id: -1 };

  const criteria: Record<string, unknown> = {
    role:
      requestedRole && roles.includes(requestedRole as UserRole)
        ? requestedRole
        : { $in: roles },
  };
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");
    criteria.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  const [users, total] = await Promise.all([
    User.find(criteria)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(criteria),
  ]);
  response.json({
    users: users.map(serializeUser),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

// DATA-01: allowlist hồ sơ chỉ gồm các trường thực sự tồn tại trong User model
// (phone). Theo D-04 không thêm trường PII plaintext chỉ vì controller nhận;
// các trường không hỗ trợ phải bị từ chối (schema strict) thay vì lưu giả.
// Quy ước giá trị: phone rỗng ("") = xóa SĐT; thiếu field = không đổi.
const phoneInputSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{6,20}$/, "Số điện thoại không hợp lệ")
  .or(z.literal(""))
  .optional();

export async function createUser(request: Request, response: Response) {
  const allowed = manageableRoles(request.user?.role);
  const body = z
    .object({
      name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự"),
      email: z.string().email("Email không hợp lệ"),
      password: passwordSchema,
      role: z.enum(["admin", "staff", "customer"]),
      status: z.enum(["Đang hoạt động", "Đã khóa"]).optional(),
      phone: phoneInputSchema,
    })
    .strict()
    .parse(request.body);

  if (!allowed.includes(body.role)) {
    response
      .status(403)
      .json({ message: "Bạn không có quyền tạo tài khoản với vai trò này." });
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
  let user;
  try {
    user = await User.create({
      name: body.name,
      email,
      passwordHash,
      role: body.role,
      status: body.status ?? "Đang hoạt động",
      isVerified: true,
      phone: body.phone || undefined,
    });
  } catch (error) {
    // API-01: race email/phone giữa check và create → unique index 11000 → 409.
    if ((error as { code?: number }).code === 11000) {
      const key =
        (error as { keyValue?: Record<string, unknown> }).keyValue ?? {};
      response.status(409).json({
        message: key.phone
          ? "Số điện thoại đã được sử dụng."
          : "Email đã tồn tại.",
      });
      return;
    }
    throw error;
  }

  // OPS-01: audit tạo tài khoản (không ghi password/hash).
  await createAuditLog({
    action: "user_created",
    entityType: "User",
    entityId: user._id,
    performedBy: request.user!.id,
    changes: {
      new: {
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone ?? null,
      },
    },
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
      password: passwordSchema.optional(),
      phone: phoneInputSchema,
    })
    .strict()
    .parse(request.body);

  // API-01: id sai định dạng → 400 thay vì CastError 500.
  if (!mongoose.isValidObjectId(body.id)) {
    response.status(400).json({ message: "ID người dùng không hợp lệ." });
    return;
  }

  const target = await User.findById(body.id);
  if (!target) {
    response.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }

  // Chỉ được sửa tài khoản thuộc nhóm vai trò mình quản lý.
  if (!allowed.includes(target.role)) {
    response
      .status(403)
      .json({ message: "Bạn không có quyền sửa tài khoản này." });
    return;
  }

  // Nếu đổi vai trò, vai trò mới cũng phải nằm trong nhóm cho phép.
  if (body.role && !allowed.includes(body.role)) {
    response
      .status(403)
      .json({ message: "Bạn không có quyền gán vai trò này." });
    return;
  }

  const previousStatus = target.status;
  const previousRole = target.role;

  // OPS-01: allowlist changed fields, không ghi password.
  const changes: {
    old: Record<string, unknown>;
    new: Record<string, unknown>;
  } = {
    old: {},
    new: {},
  };
  const auditFields = ["name", "role", "status", "phone"] as const;
  type AuditField = (typeof auditFields)[number];
  const beforeAudit: Partial<Record<AuditField, unknown>> = {
    name: target.name,
    role: target.role,
    status: target.status,
    phone: target.phone ?? null,
  };

  if (body.name !== undefined) target.name = body.name;
  if (body.role !== undefined) target.role = body.role;
  if (body.status !== undefined) target.status = body.status;
  if (body.password) target.passwordHash = await bcrypt.hash(body.password, 12);
  if (body.phone === "") {
    target.phone = undefined; // "" = xóa SĐT
  } else if (body.phone !== undefined) {
    const phoneExisted = await User.findOne({
      phone: body.phone,
      _id: { $ne: target._id },
    });
    if (phoneExisted) {
      response.status(409).json({ message: "Số điện thoại đã được sử dụng." });
      return;
    }
    target.phone = body.phone;
  }

  await target.save();

  // SEC-01: khóa / đổi vai trò / đặt lại mật khẩu phải vô hiệu hóa phiên cũ
  // của tài khoản bị tác động để claims trong JWT không còn được tin theo.
  if (
    target.status !== previousStatus ||
    target.role !== previousRole ||
    body.password
  ) {
    await revokeUserSessions(target._id);
  }

  for (const field of auditFields) {
    const afterValue =
      field === "phone" ? (target.phone ?? null) : target[field];
    if (beforeAudit[field] !== afterValue) {
      changes.old[field] = beforeAudit[field];
      changes.new[field] = afterValue;
    }
  }
  if (body.password) {
    // Ghi nhận đã đổi mật khẩu mà không lưu giá trị.
    changes.old.password = "******";
    changes.new.password = "(đã thay đổi)";
  }
  if (Object.keys(changes.old).length) {
    await createAuditLog({
      action: "user_updated",
      entityType: "User",
      entityId: target._id,
      performedBy: request.user!.id,
      changes,
    });
  }

  response.json({ user: serializeUser(target) });
}

export async function deleteUser(request: Request, response: Response) {
  const allowed = manageableRoles(request.user?.role);
  const id = request.params.id;

  // API-01: id sai định dạng → 400 thay vì CastError 500.
  if (!mongoose.isValidObjectId(id)) {
    response.status(400).json({ message: "ID người dùng không hợp lệ." });
    return;
  }

  const target = await User.findById(id);
  if (!target) {
    response.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }

  if (!allowed.includes(target.role)) {
    response
      .status(403)
      .json({ message: "Bạn không có quyền xóa tài khoản này." });
    return;
  }

  if (request.user?.id === id) {
    response
      .status(400)
      .json({ message: "Không thể xóa chính tài khoản của bạn." });
    return;
  }

  // LIFE-01 / D-03: không tự động bỏ người khỏi ca đang trực hoặc ca tương lai.
  // Việc bàn giao/hủy ca phải được thực hiện rõ ràng trước khi offboard.
  if (target.role === "staff" && target.status !== "Đã khóa") {
    const now = new Date();
    const activeOrFutureSchedule = await ShiftSchedule.findOne({
      staffId: target._id,
      $or: [
        { status: "checked_in" },
        { status: "scheduled", date: { $gte: now } },
      ],
    }).select("_id status date shiftType");

    if (activeOrFutureSchedule) {
      response.status(409).json({
        message:
          "Không thể offboard nhân viên khi còn ca đang trực hoặc ca chưa được bàn giao/hủy.",
        code: "STAFF_SCHEDULE_HANDOVER_REQUIRED",
      });
      return;
    }
  }

  // LIFE-01: không xóa cứng — lịch sử ca/parking/dispute/audit còn tham chiếu
  // user và không có cascade delete. Offboarding = khóa tài khoản + thu hồi
  // phiên (SEC-01). Tên và định danh vẫn hiển thị trong lịch sử.
  const wasAlreadyLocked = target.status === "Đã khóa";
  if (!wasAlreadyLocked) {
    target.status = "Đã khóa";
    await target.save();
  }

  // SEC-01: thu hồi phiên đăng nhập còn lại của tài khoản vừa offboard.
  await revokeUserSessions(target._id);

  // OPS-01: audit offboarding.
  await createAuditLog({
    action: wasAlreadyLocked ? "user_offboarded_noop" : "user_offboarded",
    entityType: "User",
    entityId: target._id,
    performedBy: request.user!.id,
    changes: wasAlreadyLocked
      ? undefined
      : { old: { status: "Đang hoạt động" }, new: { status: "Đã khóa" } },
  });

  response.json({
    id,
    status: "offboarded",
    message:
      "Tài khoản đã bị khóa thay vì xóa để bảo toàn lịch sử vận hành. Hủy các phân công/lịch chưa diễn ra nếu cần.",
  });
}

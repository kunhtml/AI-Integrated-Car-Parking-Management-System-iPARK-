import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  STAFF_APPLICATION_SHIFTS,
  STAFF_APPLICATION_STATUSES,
  StaffApplication,
  type StaffApplicationStatus,
} from "../models/StaffApplication.js";
import { StaffApplicationHistory } from "../models/StaffApplicationHistory.js";
import { User } from "../models/User.js";
import { createNotification } from "../services/notification.service.js";
import {
  appendHistory,
  createApplication,
  getApplicationHistory,
  getApplicationPayload,
  saveDraft,
  submitExistingApplication,
  type ApplicationPayload,
} from "../services/staffApplications.service.js";
import { serializeStaffApplication } from "../utils/serializers.js";

const applicationInputSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(6)
      .max(20)
      .regex(/^[0-9+().\s-]+$/, "Số điện thoại không hợp lệ."),
    idCardNumber: z
      .string()
      .trim()
      .regex(/^(\d{9}|\d{12})$/, "Số CCCD/CMND phải có 9 hoặc 12 chữ số."),
    address: z.string().trim().min(5).max(255),
    experience: z.string().trim().max(1000).optional(),
    reason: z.string().trim().min(20).max(1000),
    preferredShift: z.enum(STAFF_APPLICATION_SHIFTS),
  })
  .strict();

const reviewSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

function applicationWithUsers(application: unknown) {
  return application as Parameters<typeof serializeStaffApplication>[0];
}

function asApplicationPayload(
  body: z.infer<typeof applicationInputSchema>,
): ApplicationPayload {
  return {
    phone: body.phone,
    idCardNumber: body.idCardNumber,
    address: body.address,
    experience: body.experience,
    reason: body.reason,
    preferredShift: body.preferredShift,
  };
}

function serializeHistoryEntry(entry: any) {
  return {
    id: entry._id.toString(),
    applicationId: entry.applicationId.toString(),
    userId: entry.userId.toString(),
    action: entry.action,
    oldStatus: entry.oldStatus ?? null,
    newStatus: entry.newStatus,
    performedBy: entry.performedBy?.toString() ?? null,
    performedRole: entry.performedRole ?? null,
    note: entry.note ?? null,
    changedFields: entry.changedFields ?? [],
    before: entry.before ?? {},
    after: entry.after ?? {},
    sequence: entry.sequence,
    createdAt: entry.createdAt.toISOString(),
  };
}

async function notifySafely(values: Parameters<typeof createNotification>[0]) {
  try {
    await createNotification(values);
  } catch (error) {
    console.error("[StaffApplications] notification failed:", error);
  }
}

async function findOwnedApplication(id: string, userId: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw Object.assign(new Error("ID đơn đăng ký không hợp lệ."), { status: 400 });
  }
  const application = await StaffApplication.findOne({ _id: id, userId });
  if (!application) {
    throw Object.assign(new Error("Không tìm thấy đơn đăng ký."), { status: 404 });
  }
  return application;
}

async function findApplication(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw Object.assign(new Error("ID đơn đăng ký không hợp lệ."), { status: 400 });
  }
  const application = await StaffApplication.findById(id);
  if (!application) {
    throw Object.assign(new Error("Không tìm thấy đơn đăng ký."), { status: 404 });
  }
  return application;
}

async function recordReviewHistory(values: {
  application: any;
  oldStatus: StaffApplicationStatus;
  action: "REJECTED" | "APPROVED";
  note?: string;
  before: ReturnType<typeof getApplicationPayload>;
  session?: mongoose.ClientSession;
}) {
  await appendHistory({
    application: values.application,
    action: values.action,
    oldStatus: values.oldStatus,
    newStatus: values.application.status,
    performedBy: values.application.reviewedBy,
    performedRole: "admin",
    note: values.note,
    before: values.before,
    after: getApplicationPayload(values.application),
    changedFields: [],
    session: values.session,
  });
}

export async function getMyStaffApplication(
  request: Request,
  response: Response,
) {
  const application = await StaffApplication.findOne({ userId: request.user!.id })
    .sort({ createdAt: -1 })
    .populate({ path: "reviewedBy", model: "User", select: "name" });

  response.json({
    application: application
      ? serializeStaffApplication(applicationWithUsers(application))
      : null,
  });
}

export async function createStaffApplication(
  request: Request,
  response: Response,
) {
  const body = applicationInputSchema.parse(request.body);
  const application = await createApplication(
    request.user!.id,
    asApplicationPayload(body),
    "submit",
  );

  await Promise.all([
    notifySafely({
      title: "Có đơn đăng ký nhân viên mới",
      content: `Khách hàng ${request.user!.name} đã gửi đơn đăng ký làm nhân viên.`,
      targetRole: "admin",
    }),
    notifySafely({
      title: "Đã tiếp nhận đơn đăng ký",
      content: "Đơn đăng ký làm nhân viên của bạn đang chờ quản trị viên xét duyệt.",
      userId: request.user!.id,
    }),
  ]);

  response.status(201).json({
    application: serializeStaffApplication(applicationWithUsers(application)),
  });
}

export async function saveMyStaffApplication(
  request: Request,
  response: Response,
) {
  const body = applicationInputSchema.parse(request.body);
  const application = await saveDraft(
    String(request.params.id),
    request.user!.id,
    asApplicationPayload(body),
  );
  response.json({
    application: serializeStaffApplication(applicationWithUsers(application)),
  });
}

export async function resubmitMyStaffApplication(
  request: Request,
  response: Response,
) {
  const application = await submitExistingApplication(
    String(request.params.id),
    request.user!.id,
  );

  await Promise.all([
    notifySafely({
      title: "Đơn đăng ký nhân viên được gửi lại",
      content: `Khách hàng ${request.user!.name} đã cập nhật và gửi lại đơn đăng ký.`,
      targetRole: "admin",
    }),
    notifySafely({
      title: "Đã gửi lại đơn đăng ký",
      content: "Đơn cũ đã được cập nhật và gửi lại để quản trị viên xét duyệt.",
      userId: request.user!.id,
    }),
  ]);

  response.json({
    application: serializeStaffApplication(applicationWithUsers(application)),
  });
}

export async function getMyStaffApplicationHistory(
  request: Request,
  response: Response,
) {
  await findOwnedApplication(String(request.params.id), request.user!.id);
  const history = await getApplicationHistory(String(request.params.id), {
    userId: request.user!.id,
  });
  response.json({ history: history.map(serializeHistoryEntry) });
}

export async function cancelMyStaffApplication(
  request: Request,
  response: Response,
) {
  const application = await StaffApplication.findOne({
    userId: request.user!.id,
    status: "pending",
  });
  if (!application) {
    response.status(409).json({ message: "Không có đơn đang chờ duyệt để hủy." });
    return;
  }

  const before = getApplicationPayload(application);
  application.status = "cancelled";
  await application.save();
  await appendHistory({
    application,
    action: "CANCELLED",
    oldStatus: "pending",
    newStatus: "cancelled",
    performedBy: request.user!.id,
    performedRole: "customer",
    before,
    after: getApplicationPayload(application),
  });

  response.json({
    application: serializeStaffApplication(applicationWithUsers(application)),
  });
}

export async function listStaffApplications(
  request: Request,
  response: Response,
) {
  const rawStatus = typeof request.query.status === "string"
    ? request.query.status
    : undefined;
  const status = rawStatus && rawStatus !== "all"
    ? z.enum(STAFF_APPLICATION_STATUSES).parse(rawStatus)
    : undefined;
  const search = typeof request.query.search === "string"
    ? request.query.search.trim().slice(0, 100)
    : "";
  const page = Math.max(
    1,
    Number.parseInt(typeof request.query.page === "string" ? request.query.page : "1", 10) || 1,
  );
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(typeof request.query.limit === "string" ? request.query.limit : "10", 10) || 10,
    ),
  );

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");
    const users = await User.find({
      $or: [{ name: regex }, { email: regex }, { phone: regex }],
    }).select("_id");
    filter.$or = [
      { phone: regex },
      { userId: { $in: users.map((user) => user._id) } },
    ];
  }

  const [applications, total] = await Promise.all([
    StaffApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "userId",
        model: "User",
        select: "name email phone avatarUrl",
      })
      .populate({ path: "reviewedBy", model: "User", select: "name" }),
    StaffApplication.countDocuments(filter),
  ]);

  response.json({
    applications: applications.map((application) =>
      serializeStaffApplication(applicationWithUsers(application), {
        maskIdCard: true,
      }),
    ),
    total,
    page,
    limit,
  });
}

export async function getStaffApplicationHistory(
  request: Request,
  response: Response,
) {
  await findApplication(String(request.params.id));
  const history = await getApplicationHistory(String(request.params.id));
  response.json({ history: history.map(serializeHistoryEntry) });
}

export async function reviewStaffApplication(
  request: Request,
  response: Response,
) {
  if (!mongoose.isValidObjectId(String(request.params.id))) {
    response.status(400).json({ message: "ID đơn đăng ký không hợp lệ." });
    return;
  }

  const body = reviewSchema.parse(request.body);
  if (body.decision === "rejected" && !body.note) {
    response.status(400).json({ message: "Vui lòng nhập lý do từ chối." });
    return;
  }

  const application = await StaffApplication.findOne({
    _id: String(request.params.id),
    status: "pending",
  });
  if (!application) {
    const existing = await StaffApplication.exists({ _id: String(request.params.id) });
    response.status(existing ? 409 : 404).json({
      message: existing ? "Đơn này đã được xử lý." : "Không tìm thấy đơn đăng ký.",
    });
    return;
  }

  const before = getApplicationPayload(application);
  const oldStatus = application.status;

  if (body.decision === "rejected") {
    application.status = "rejected";
    application.reviewNote = body.note;
    application.reviewedBy = new mongoose.Types.ObjectId(request.user!.id);
    application.reviewedAt = new Date();
    await application.save();
    await recordReviewHistory({
      application,
      oldStatus,
      action: "REJECTED",
      note: body.note,
      before,
    });

    await notifySafely({
      title: "Đơn đăng ký nhân viên bị từ chối",
      content: body.note || "Đơn đăng ký của bạn chưa được thông qua.",
      userId: application.userId.toString(),
    });

    await application.populate({ path: "reviewedBy", model: "User", select: "name" });
    response.json({
      application: serializeStaffApplication(applicationWithUsers(application), {
        maskIdCard: true,
      }),
    });
    return;
  }

  const user = await User.findOne({
    _id: application.userId,
    role: "customer",
    status: "Đang hoạt động",
  });
  if (!user) {
    throw Object.assign(
      new Error("Tài khoản người đăng ký không còn đủ điều kiện."),
      { status: 409 },
    );
  }

  const updatedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      role: "customer",
      status: "Đang hoạt động",
    },
    { $set: { role: "staff" } },
    { new: true },
  );
  if (!updatedUser) {
    throw Object.assign(new Error("Tài khoản đã được xử lý trước đó."), {
      status: 409,
    });
  }

  application.status = "approved";
  application.reviewNote = body.note;
  application.reviewedBy = new mongoose.Types.ObjectId(request.user!.id);
  application.approvedBy = new mongoose.Types.ObjectId(request.user!.id);
  application.reviewedAt = new Date();
  application.approvedAt = application.reviewedAt;
  await application.save();
  await recordReviewHistory({
    application,
    oldStatus,
    action: "APPROVED",
    note: body.note,
    before,
  });

  await notifySafely({
    title: "Đơn đăng ký nhân viên đã được duyệt",
    content: "Chúc mừng! Tài khoản của bạn đã được nâng quyền nhân viên. Vui lòng đăng nhập lại.",
    userId: application.userId.toString(),
  });

  await application.populate({ path: "reviewedBy", model: "User", select: "name" });
  response.json({
    application: serializeStaffApplication(applicationWithUsers(application), {
      maskIdCard: true,
    }),
  });
}

export async function countApplicationHistory(applicationId: string) {
  return StaffApplicationHistory.countDocuments({ applicationId });
}

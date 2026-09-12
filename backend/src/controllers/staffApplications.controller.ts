import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  STAFF_APPLICATION_SHIFTS,
  STAFF_APPLICATION_STATUSES,
  StaffApplication,
  type StaffApplicationDocument,
  type StaffApplicationStatus,
} from "../models/StaffApplication.js";
import { StaffApplicationHistory } from "../models/StaffApplicationHistory.js";
import { User } from "../models/User.js";
import { createNotification } from "../services/notification.service.js";
import {
  appendHistory,
  cancelApplication,
  createApplication,
  getApplicationHistory,
  getApplicationPayload,
  saveDraft,
  submitExistingApplication,
  type ApplicationPayload,
} from "../services/staffApplications.service.js";
import { fingerprintField } from "../utils/crypto.util.js";
import { serializeStaffApplication } from "../utils/serializers.js";

const applicationInputSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(6)
      .max(20)
      .regex(/^[0-9+\-\s()]{6,20}$/, "Số điện thoại không hợp lệ."),
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
    throw Object.assign(new Error("ID đơn đăng ký không hợp lệ."), {
      status: 400,
    });
  }
  const application = await StaffApplication.findOne({ _id: id, userId });
  if (!application) {
    throw Object.assign(new Error("Không tìm thấy đơn đăng ký."), {
      status: 404,
    });
  }
  return application;
}

async function findApplication(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw Object.assign(new Error("ID đơn đăng ký không hợp lệ."), {
      status: 400,
    });
  }
  const application = await StaffApplication.findById(id);
  if (!application) {
    throw Object.assign(new Error("Không tìm thấy đơn đăng ký."), {
      status: 404,
    });
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
  const application = await StaffApplication.findOne({
    userId: request.user!.id,
  })
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
      content:
        "Đơn đăng ký làm nhân viên của bạn đang chờ quản trị viên xét duyệt.",
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
  // APP-01: gửi lại trên cùng ID, cho phép cập nhật nội dung kèm submit
  // trong một thao tác nguyên tử (draft trung gian không còn cần thiết).
  const body =
    request.body && Object.keys(request.body).length
      ? applicationInputSchema.parse(request.body)
      : undefined;
  const application = await submitExistingApplication(
    String(request.params.id),
    request.user!.id,
    body ? asApplicationPayload(body) : undefined,
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
  // APP-02: hủy nguyên tử qua service (conditional update + history cùng transaction).
  const application = await cancelApplication(request.user!.id);

  response.json({
    application: serializeStaffApplication(applicationWithUsers(application)),
  });
}

export async function listStaffApplications(
  request: Request,
  response: Response,
) {
  const rawStatus =
    typeof request.query.status === "string" ? request.query.status : undefined;
  const status =
    rawStatus && rawStatus !== "all"
      ? z.enum(STAFF_APPLICATION_STATUSES).parse(rawStatus)
      : undefined;
  const search =
    typeof request.query.search === "string"
      ? request.query.search.trim().slice(0, 100)
      : "";
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
        typeof request.query.limit === "string" ? request.query.limit : "10",
        10,
      ) || 10,
    ),
  );

  const filter: Record<string, unknown> & {
    $or?: Array<Record<string, unknown>>;
  } = {};
  if (status) filter.status = status;

  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");
    const users = await User.find({
      $or: [{ name: regex }, { email: regex }, { phone: regex }],
    }).select("_id");

    const normalizedSearch = search.replace(/\s+/g, "");
    const isIdCardSearch = /^\d{9}$|^\d{12}$/.test(normalizedSearch);

    filter.$or = [
      { phone: regex },
      { userId: { $in: users.map((user) => user._id) } },
    ];

    if (isIdCardSearch) {
      filter.$or.push({
        idCardNumberFingerprint: fingerprintField(normalizedSearch),
      });
    }
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

  // APP-02: review nguyên tử — application (conditional theo status pending)
  // + history trong một transaction; approve thêm CAS nâng role user trong
  // cùng transaction để không có staff đi kèm đơn rejected/cancelled do race.
  // Thông báo chỉ gửi sau khi commit thành công.
  let application: StaffApplicationDocument | undefined;
  try {
    application = await runWithTransactionOrDirect(async (session) => {
      const q = StaffApplication.findOne({
        _id: String(request.params.id),
        status: "pending",
      });
      const current = session ? await q.session(session) : await q;
      if (!current) {
        const existing = session
          ? await StaffApplication.findOne({ _id: String(request.params.id) }, null, { session })
          : await StaffApplication.findOne({ _id: String(request.params.id) });
        throw Object.assign(
          new Error(
            existing ? "Đơn này đã được xử lý." : "Không tìm thấy đơn đăng ký.",
          ),
          { status: existing ? 409 : 404 },
        );
      }

      const before = getApplicationPayload(current);
      const oldStatus = current.status;
      const now = new Date();
      const reviewerId = new mongoose.Types.ObjectId(request.user!.id);
      const updateOptions: any = { new: true };
      if (session) updateOptions.session = session;

      if (body.decision === "rejected") {
        const updated = await StaffApplication.findOneAndUpdate(
          { _id: current._id, status: "pending" },
          {
            $set: {
              status: "rejected",
              reviewNote: body.note,
              reviewedBy: reviewerId,
              reviewedAt: now,
            },
          },
          updateOptions,
        );
        if (!updated) {
          throw Object.assign(new Error("Đơn vừa được xử lý trước đó."), {
            status: 409,
          });
        }
        await recordReviewHistory({
          application: updated,
          oldStatus,
          action: "REJECTED",
          note: body.note,
          before,
          session,
        });
        return updated;
      }

      // Approve: CAS user role trước, rồi cập nhật application + history.
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: current.userId,
          role: "customer",
          status: "Đang hoạt động",
        },
        { $set: { role: "staff" } },
        updateOptions,
      );
      if (!updatedUser) {
        throw Object.assign(
          new Error("Tài khoản người đăng ký không còn đủ điều kiện."),
          { status: 409 },
        );
      }

      const updated = await StaffApplication.findOneAndUpdate(
        { _id: current._id, status: "pending" },
        {
          $set: {
            status: "approved",
            reviewNote: body.note,
            reviewedBy: reviewerId,
            approvedBy: reviewerId,
            reviewedAt: now,
            approvedAt: now,
          },
        },
        updateOptions,
      );
      if (!updated) {
        throw Object.assign(new Error("Đơn vừa được xử lý trước đó."), {
          status: 409,
        });
      }
      await recordReviewHistory({
        application: updated,
        oldStatus,
        action: "APPROVED",
        note: body.note,
        before,
        session,
      });
      return updated;
    });

    if (!application) {
      response.status(500).json({ message: "Không xét duyệt được đơn." });
      return;
    }

    // Sau commit: thông báo + populate để trả response.
    await notifySafely(
      body.decision === "rejected"
        ? {
            title: "Đơn đăng ký nhân viên bị từ chối",
            content: body.note || "Đơn đăng ký của bạn chưa được thông qua.",
            userId: application.userId.toString(),
          }
        : {
            title: "Đơn đăng ký nhân viên đã được duyệt",
            content:
              "Chúc mừng! Tài khoản của bạn đã được nâng quyền nhân viên. Vui lòng đăng nhập lại.",
            userId: application.userId.toString(),
          },
    );

    const [populated] = await StaffApplication.populate([application], {
      path: "reviewedBy",
      model: "User",
      select: "name",
    });
    application = populated;
    response.json({
      application: serializeStaffApplication(
        applicationWithUsers(application),
        {
          maskIdCard: true,
        },
      ),
    });
  } finally {
    await session.endSession();
  }
}

export async function countApplicationHistory(applicationId: string) {
  return StaffApplicationHistory.countDocuments({ applicationId });
}

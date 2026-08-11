import mongoose from "mongoose";
import {
  STAFF_APPLICATION_SHIFTS,
  STAFF_APPLICATION_STATUSES,
  StaffApplication,
  type StaffApplicationDocument,
  type StaffApplicationShift,
  type StaffApplicationStatus,
} from "../models/StaffApplication.js";
import {
  StaffApplicationHistory,
  type StaffApplicationHistoryAction,
  type StaffApplicationSnapshot,
} from "../models/StaffApplicationHistory.js";
import { User } from "../models/User.js";

export type ApplicationPayload = {
  phone?: string;
  idCardNumber?: string;
  address?: string;
  experience?: string;
  reason?: string;
  preferredShift?: StaffApplicationShift;
};

export const applicationFields = [
  "phone",
  "idCardNumber",
  "address",
  "experience",
  "reason",
  "preferredShift",
] as const;

export function snapshotOf(value: Partial<ApplicationPayload>): StaffApplicationSnapshot {
  const snapshot: StaffApplicationSnapshot = {};
  for (const field of applicationFields) {
    const fieldValue = value[field];
    if (fieldValue !== undefined && fieldValue !== "") {
      snapshot[field] = fieldValue as never;
    }
  }
  return snapshot;
}

export function changedFields(
  before: StaffApplicationSnapshot,
  after: StaffApplicationSnapshot,
) {
  return applicationFields.filter(
    (field) => (before[field] ?? "") !== (after[field] ?? ""),
  );
}

export function getApplicationPayload(application: StaffApplicationDocument) {
  return snapshotOf(application);
}

async function nextSequence(
  applicationId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession,
) {
  const last = await StaffApplicationHistory.findOne({ applicationId })
    .sort({ sequence: -1 })
    .select("sequence")
    .session(session ?? null);
  return (last?.sequence ?? 0) + 1;
}

export async function appendHistory(values: {
  application: StaffApplicationDocument;
  action: StaffApplicationHistoryAction;
  oldStatus?: StaffApplicationStatus;
  newStatus: StaffApplicationStatus;
  performedBy?: string | mongoose.Types.ObjectId;
  performedRole?: "customer" | "admin" | "staff";
  note?: string;
  before: StaffApplicationSnapshot;
  after: StaffApplicationSnapshot;
  changedFields?: string[];
  session?: mongoose.ClientSession;
}) {
  const performedBy = values.performedBy
    ? new mongoose.Types.ObjectId(values.performedBy.toString())
    : undefined;
  await StaffApplicationHistory.create(
    [
      {
        applicationId: values.application._id,
        userId: values.application.userId,
        action: values.action,
        oldStatus: values.oldStatus,
        newStatus: values.newStatus,
        performedBy,
        performedRole: values.performedRole,
        note: values.note,
        before: values.before,
        after: values.after,
        changedFields: values.changedFields ?? changedFields(values.before, values.after),
        sequence: await nextSequence(values.application._id, values.session),
      },
    ],
    { session: values.session },
  );
}

export async function assertActiveCustomer(userId: string) {
  const user = await User.findOne({
    _id: userId,
    role: "customer",
    status: "Đang hoạt động",
  });
  if (!user) {
    throw Object.assign(new Error("Tài khoản không đủ điều kiện đăng ký."), {
      status: 403,
    });
  }
  return user;
}

export async function createApplication(
  userId: string,
  payload: ApplicationPayload,
  mode: "draft" | "submit",
) {
  await assertActiveCustomer(userId);
  const existingPending = await StaffApplication.exists({ userId, status: "pending" });
  if (existingPending) {
    throw Object.assign(new Error("Bạn đã có đơn đang chờ duyệt."), { status: 409 });
  }

  let application: StaffApplicationDocument;
  try {
    application = await StaffApplication.create({
      ...payload,
      userId,
      status: mode === "draft" ? "draft" : "pending",
      submittedAt: mode === "submit" ? new Date() : undefined,
      resubmitCount: 0,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw Object.assign(new Error("Bạn đã có đơn đang chờ duyệt."), { status: 409 });
    }
    throw error;
  }

  const after = getApplicationPayload(application);
  await appendHistory({
    application,
    action: mode === "draft" ? "DRAFT_CREATED" : "SUBMITTED",
    newStatus: application.status,
    performedBy: userId,
    performedRole: "customer",
    before: {},
    after,
  });
  return application;
}

export async function saveDraft(
  id: string,
  userId: string,
  payload: ApplicationPayload,
) {
  const application = await StaffApplication.findById(id);
  if (!application) throw Object.assign(new Error("Không tìm thấy đơn đăng ký."), { status: 404 });
  if (application.userId.toString() !== userId) {
    throw Object.assign(new Error("Không có quyền sửa đơn đăng ký này."), { status: 403 });
  }
  if (application.status !== "draft" && application.status !== "rejected") {
    throw Object.assign(new Error("Chỉ được sửa đơn nháp hoặc đơn bị từ chối."), { status: 409 });
  }

  const before = getApplicationPayload(application);
  const oldStatus = application.status;
  Object.assign(application, payload, { status: "draft" });
  const after = getApplicationPayload(application);
  await application.save();
  await appendHistory({
    application,
    action: "EDITED",
    oldStatus,
    newStatus: "draft",
    performedBy: userId,
    performedRole: "customer",
    before,
    after,
  });
  return application;
}

export async function submitExistingApplication(id: string, userId: string) {
  await assertActiveCustomer(userId);
  const application = await StaffApplication.findById(id);
  if (!application) throw Object.assign(new Error("Không tìm thấy đơn đăng ký."), { status: 404 });
  if (application.userId.toString() !== userId) {
    throw Object.assign(new Error("Không có quyền gửi đơn đăng ký này."), { status: 403 });
  }
  if (application.status !== "draft" && application.status !== "rejected") {
    throw Object.assign(new Error("Chỉ được gửi đơn nháp hoặc gửi lại đơn bị từ chối."), { status: 409 });
  }

  const missing = ["phone", "idCardNumber", "address", "reason", "preferredShift"]
    .filter((field) => !application.get(field));
  if (missing.length) {
    throw Object.assign(new Error("Vui lòng bổ sung đầy đủ thông tin bắt buộc."), { status: 400 });
  }

  const oldStatus = application.status;
  const before = getApplicationPayload(application);
  const now = new Date();
  application.status = "pending";
  application.submittedAt = now;
  if (oldStatus === "rejected") {
    application.resubmitCount += 1;
    application.resubmittedAt = now;
  }
  await application.save();
  await appendHistory({
    application,
    action: oldStatus === "rejected" ? "RESUBMITTED" : "SUBMITTED",
    oldStatus,
    newStatus: "pending",
    performedBy: userId,
    performedRole: "customer",
    before,
    after: getApplicationPayload(application),
    changedFields: [],
  });
  return application;
}

export async function getApplicationHistory(
  applicationId: string,
  options: { userId?: string; session?: mongoose.ClientSession } = {},
) {
  const filter: Record<string, unknown> = { applicationId };
  if (options.userId) filter.userId = options.userId;
  return StaffApplicationHistory.find(filter)
    .sort({ sequence: 1 })
    .session(options.session ?? null)
    .lean();
}

export async function cancelApplication(userId: string) {
  const application = await StaffApplication.findOneAndUpdate(
    { userId, status: "pending" },
    { $set: { status: "cancelled" } },
    { new: true },
  );
  if (!application) {
    throw Object.assign(new Error("Không có đơn đang chờ duyệt để hủy."), { status: 409 });
  }
  const snapshot = getApplicationPayload(application);
  await appendHistory({
    application,
    action: "CANCELLED",
    oldStatus: "pending",
    newStatus: "cancelled",
    performedBy: userId,
    performedRole: "customer",
    before: snapshot,
    after: snapshot,
  });
  return application;
}

export { STAFF_APPLICATION_SHIFTS, STAFF_APPLICATION_STATUSES };

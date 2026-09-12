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
import {
  decryptField,
  encryptField,
  fingerprintField,
} from "../utils/crypto.util.js";

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

export function snapshotOf(
  value: Partial<ApplicationPayload>,
): StaffApplicationSnapshot {
  // APP-03: hàm này nhận PLAINTEXT (payload từ request). Với document DB
  // (idCardNumber đã mã hóa) phải dùng getApplicationPayload bên dưới.
  const snapshot: StaffApplicationSnapshot = {};
  for (const field of applicationFields) {
    const fieldValue = value[field];
    if (fieldValue !== undefined && fieldValue !== "") {
      if (field === "idCardNumber" && typeof fieldValue === "string") {
        snapshot[field] = maskIdCardValue(fieldValue) as never;
      } else {
        snapshot[field] = fieldValue as never;
      }
    }
  }
  return snapshot;
}

// APP-03: giá trị che sinh từ plaintext; cùng CCCD luôn cho cùng giá trị
// bất kể IV mã hóa → changedFields so sánh snapshot chính xác.
function maskIdCardValue(plain: string): string {
  return plain.length <= 4 ? "***" : `***${plain.slice(-4)}`;
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
  // APP-03: document DB lưu ciphertext (IV ngẫu nhiên) → decrypt trước khi
  // mask. Snapshot cũ trong history từng lấy hậu tố ciphertext — không tự
  // suy ra số cuối từ ciphertext để backfill, giữ nguyên bản ghi lịch sử.
  const decryptedIdCard = application.idCardNumber
    ? decryptField(application.idCardNumber)
    : undefined;
  return snapshotOf({
    phone: application.phone,
    idCardNumber: decryptedIdCard,
    address: application.address,
    experience: application.experience,
    reason: application.reason,
    preferredShift: application.preferredShift,
  });
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
        changedFields:
          values.changedFields ?? changedFields(values.before, values.after),
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

function prepareApplicationPayload(payload: ApplicationPayload) {
  const next = { ...payload };

  if (payload.idCardNumber) {
    next.idCardNumber = encryptField(payload.idCardNumber);
    (next as any).idCardNumberFingerprint = fingerprintField(
      payload.idCardNumber,
    );
  }

  return next;
}

let _isReplicaSetCached: boolean | null = null;

async function isReplicaSet(): Promise<boolean> {
  if (_isReplicaSetCached !== null) return _isReplicaSetCached;
  try {
    const adminDb = mongoose.connection.db?.admin();
    if (!adminDb) return false;
    const status = await adminDb.command({ replSetGetStatus: 1 });
    _isReplicaSetCached = Boolean(status && status.ok);
  } catch {
    _isReplicaSetCached = false;
  }
  return _isReplicaSetCached;
}

async function runWithTransactionOrDirect<T>(
  fn: (session?: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  const hasReplica = await isReplicaSet();
  if (!hasReplica) {
    return await fn(undefined);
  }

  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } catch (err: any) {
    if (
      err &&
      (err.message?.includes("replica set") ||
        err.message?.includes("Transaction numbers are only allowed"))
    ) {
      _isReplicaSetCached = false;
      return await fn(undefined);
    }
    throw err;
  } finally {
    if (session) {
      await session.endSession().catch(() => undefined);
    }
  }
}


export async function createApplication(
  userId: string,
  payload: ApplicationPayload,
  mode: "draft" | "submit",
) {
  await assertActiveCustomer(userId);

  return await runWithTransactionOrDirect(async (session) => {
    const existingPending = await StaffApplication.findOne(
      { userId, status: "pending" },
      null,
      session ? { session } : {},
    );
    if (existingPending) {
      throw Object.assign(new Error("Bạn đã có đơn đang chờ duyệt."), {
        status: 409,
      });
    }

    const preparedPayload = prepareApplicationPayload(payload);
    const [created] = await StaffApplication.create(
      [
        {
          ...preparedPayload,
          userId,
          status: mode === "draft" ? "draft" : "pending",
          submittedAt: mode === "submit" ? new Date() : undefined,
          resubmitCount: 0,
        },
      ],
      session ? { session } : {},
    );

    const after = getApplicationPayload(created);
    await appendHistory({
      application: created,
      action: mode === "draft" ? "DRAFT_CREATED" : "SUBMITTED",
      newStatus: created.status,
      performedBy: userId,
      performedRole: "customer",
      before: {},
      after,
      session,
    });

    return created;
  });
}

export async function saveDraft(
  id: string,
  userId: string,
  payload: ApplicationPayload,
) {
  // APP-01: lưu nháp KHÔNG đổi trạng thái — rejected giữ nguyên "rejected"
  // để lần submit sau vẫn được nhận diện là RESUBMITTED; draft giữ "draft".
  // APP-02: conditional update nguyên tử theo trạng thái hiện tại.
  const session = await mongoose.startSession();
  try {
    let application: StaffApplicationDocument | undefined;
    await session.withTransaction(async () => {
      const current = await StaffApplication.findOne({
        _id: id,
        userId,
      }).session(session);
      if (!current) {
        throw Object.assign(new Error("Không tìm thấy đơn đăng ký."), {
          status: 404,
        });
      }
      if (current.status !== "draft" && current.status !== "rejected") {
        throw Object.assign(
          new Error("Chỉ được sửa đơn nháp hoặc đơn bị từ chối."),
          { status: 409 },
        );
      }

      const before = getApplicationPayload(current);
      const oldStatus = current.status;
      const updated = await StaffApplication.findOneAndUpdate(
        { _id: id, userId, status: oldStatus },
        { $set: { ...prepareApplicationPayload(payload) } },
        { new: true, session },
      );
      if (!updated) {
        throw Object.assign(new Error("Đơn vừa thay đổi, vui lòng thử lại."), {
          status: 409,
        });
      }

      await appendHistory({
        application: updated,
        action: "EDITED",
        oldStatus,
        newStatus: oldStatus,
        performedBy: userId,
        performedRole: "customer",
        before,
        after: getApplicationPayload(updated),
        session,
      });
      application = updated;
    });
    if (!application) {
      throw Object.assign(new Error("Không lưu được đơn đăng ký."), {
        status: 500,
      });
    }
    return application;
  } finally {
    await session.endSession();
  }
}

export async function submitExistingApplication(
  id: string,
  userId: string,
  payload?: ApplicationPayload,
) {
  await assertActiveCustomer(userId);

  return await runWithTransactionOrDirect(async (session) => {
    const q = StaffApplication.findOne({ _id: id, userId });
    const current = session ? await q.session(session) : await q;
    if (!current) {
      throw Object.assign(new Error("Không tìm thấy đơn đăng ký."), {
        status: 404,
      });
    }
    if (current.status !== "draft" && current.status !== "rejected") {
      throw Object.assign(
        new Error("Chỉ được gửi đơn nháp hoặc gửi lại đơn bị từ chối."),
        { status: 409 },
      );
    }

    const missing = [
      "phone",
      "idCardNumber",
      "address",
      "reason",
      "preferredShift",
    ].filter((field) => !current.get(field));
    if (missing.length) {
      throw Object.assign(
        new Error("Vui lòng bổ sung đầy đủ thông tin bắt buộc."),
        { status: 400 },
      );
    }

    const oldStatus = current.status;
    const before = getApplicationPayload(current);
    const now = new Date();
    const updateSet: Record<string, unknown> = {
      status: "pending",
      submittedAt: now,
      ...(oldStatus === "rejected"
        ? {
            resubmitCount: (current.resubmitCount ?? 0) + 1,
            resubmittedAt: now,
          }
        : {}),
    };
    if (payload) {
      Object.assign(updateSet, prepareApplicationPayload(payload));
    }
    const updateOptions: any = { new: true };
    if (session) updateOptions.session = session;

    const updated = await StaffApplication.findOneAndUpdate(
      { _id: id, userId, status: oldStatus },
      { $set: updateSet },
      updateOptions,
    );
    if (!updated) {
      throw Object.assign(
        new Error("Đơn vừa thay đổi bởi thao tác khác, vui lòng thử lại."),
        { status: 409 },
      );
    }

    const after = getApplicationPayload(updated);
    const action =
      oldStatus === "rejected" || (current.resubmitCount ?? 0) > 0
        ? "RESUBMITTED"
        : "SUBMITTED";

    await appendHistory({
      application: updated,
      action,
      oldStatus,
      newStatus: "pending",
      performedBy: userId,
      performedRole: "customer",
      before,
      after,
      session,
    });

    return updated;
  });
}

export async function cancelApplication(userId: string) {
  // APP-02: cancel nguyên tử theo trạng thái pending; history cùng transaction.
  const session = await mongoose.startSession();
  try {
    let application: StaffApplicationDocument | undefined;
    await session.withTransaction(async () => {
      const updated = await StaffApplication.findOneAndUpdate(
        { userId, status: "pending" },
        { $set: { status: "cancelled" } },
        { new: true, session },
      );
      if (!updated) {
        throw Object.assign(new Error("Không có đơn đang chờ duyệt để hủy."), {
          status: 409,
        });
      }
      const snapshot = getApplicationPayload(updated);
      await appendHistory({
        application: updated,
        action: "CANCELLED",
        oldStatus: "pending",
        newStatus: "cancelled",
        performedBy: userId,
        performedRole: "customer",
        before: snapshot,
        after: snapshot,
        changedFields: [],
        session,
      });
      application = updated;
    });
    if (!application) {
      throw Object.assign(new Error("Không hủy được đơn đăng ký."), {
        status: 500,
      });
    }
    return application;
  } finally {
    await session.endSession();
  }
}

export { STAFF_APPLICATION_SHIFTS, STAFF_APPLICATION_STATUSES };

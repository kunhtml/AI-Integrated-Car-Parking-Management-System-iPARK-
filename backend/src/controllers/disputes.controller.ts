import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  Dispute,
  DISPUTE_REASONS,
  DISPUTE_STATUSES,
} from "../models/Dispute.js";
import { Incident } from "../models/Incident.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { createNotification } from "../services/notification.service.js";
import { serializeDispute } from "../utils/serializers.js";

function generateCode() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KN-${stamp}-${rand}`;
}

/** Lấy danh sách _id các phiên thuộc về user (khớp ownerUserId hoặc ownerEmail). */
async function findOwnedSessionIds(userId: string) {
  const user = await User.findById(userId).select("email");
  const filter = user?.email
    ? {
        $or: [
          { ownerUserId: userId },
          { ownerEmail: user.email.toLowerCase() },
        ],
      }
    : { ownerUserId: userId };
  const sessions = await ParkingSession.find(filter, { _id: 1 });
  return sessions.map((session) => session._id.toString());
}

/** GET /api/disputes/references — phiên & giao dịch của khách để chọn khi tạo khiếu nại. */
export async function listDisputeReferences(
  request: Request,
  response: Response,
) {
  const userId = request.user!.id;
  const sessionIds = await findOwnedSessionIds(userId);

  const sessions = await ParkingSession.find({ _id: { $in: sessionIds } })
    .sort({ createdAt: -1 })
    .limit(50);

  const transactions = await Transaction.find({
    $or: [{ userId }, { sessionId: { $in: sessionIds } }],
  })
    .sort({ createdAt: -1 })
    .limit(50);

  const sessionMap = new Map(
    sessions.map((session) => [session._id.toString(), session]),
  );

  response.json({
    sessions: sessions.map((session) => ({
      id: session._id.toString(),
      plate: session.plate,
      slot: session.slot,
      status: session.status,
      fee: session.fee,
      checkInAt: session.checkInAt.toISOString(),
      checkOutAt: session.checkOutAt ? session.checkOutAt.toISOString() : null,
    })),
    transactions: transactions.map((transaction) => ({
      id: transaction._id.toString(),
      sessionId: transaction.sessionId?.toString(),
      plate: transaction.sessionId
        ? sessionMap.get(transaction.sessionId.toString())?.plate
        : undefined,
      method: transaction.method,
      amount: transaction.amount,
      status: transaction.status,
      createdAt: transaction.createdAt.toISOString(),
    })),
  });
}

/** GET /api/disputes — khách xem khiếu nại của mình, admin/staff xem tất cả. */
export async function listDisputes(request: Request, response: Response) {
  const criteria =
    request.user?.role === "customer" ? { userId: request.user.id } : {};
  const disputes = await Dispute.find(criteria)
    .sort({ createdAt: -1 })
    .limit(200);
  response.json({ disputes: disputes.map(serializeDispute) });
}

/** GET /api/disputes/by-code/:code — tra cứu dispute theo code (dùng cho incidents-view). */
export async function getDisputeByCode(request: Request, response: Response) {
  const dispute = await Dispute.findOne({ code: request.params.code });
  if (!dispute) {
    response.status(404).json({ message: "Không tìm thấy khiếu nại." });
    return;
  }
  response.json({ dispute: serializeDispute(dispute) });
}

/** GET /api/disputes/:id */
export async function getDispute(request: Request, response: Response) {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ message: "ID khiếu nại không hợp lệ." });
    return;
  }

  const dispute = await Dispute.findById(request.params.id);
  if (!dispute) {
    response.status(404).json({ message: "Không tìm thấy khiếu nại." });
    return;
  }
  if (
    request.user?.role === "customer" &&
    dispute.userId.toString() !== request.user.id
  ) {
    response.status(403).json({ message: "Không có quyền xem khiếu nại này." });
    return;
  }

  response.json({ dispute: serializeDispute(dispute) });
}

/** POST /api/disputes — khách đăng ký gửi khiếu nại (UC15). */
export async function createDispute(request: Request, response: Response) {
  const body = z
    .object({
      sessionId: z.string().trim().optional(),
      transactionId: z.string().trim().optional(),
      reason: z.enum(DISPUTE_REASONS),
      content: z
        .string()
        .trim()
        .min(10, "Nội dung tối thiểu 10 ký tự.")
        .max(2000),
      contactName: z.string().trim().min(2),
      contactPhone: z
        .string()
        .trim()
        .regex(/^0\d{9,10}$/, "Số điện thoại không hợp lệ."),
      contactEmail: z.string().trim().email().optional(),
      attachments: z.array(z.string().trim()).max(5).optional(),
    })
    .parse(request.body);

  const userId = request.user!.id;
  const ownedSessionIds = await findOwnedSessionIds(userId);
  let plate: string | undefined;

  if (body.sessionId) {
    if (!ownedSessionIds.includes(body.sessionId)) {
      response
        .status(403)
        .json({ message: "Phiên gửi xe không thuộc về bạn." });
      return;
    }
    plate = (await ParkingSession.findById(body.sessionId))?.plate;
  }

  if (body.transactionId) {
    if (!mongoose.isValidObjectId(body.transactionId)) {
      response.status(400).json({ message: "ID giao dịch không hợp lệ." });
      return;
    }
    const transaction = await Transaction.findById(body.transactionId);
    const ownsTransaction =
      transaction &&
      (transaction.userId?.toString() === userId ||
        (transaction.sessionId &&
          ownedSessionIds.includes(transaction.sessionId.toString())));
    if (!ownsTransaction) {
      response.status(403).json({ message: "Giao dịch không thuộc về bạn." });
      return;
    }
    if (!plate && transaction.sessionId) {
      plate = (await ParkingSession.findById(transaction.sessionId))?.plate;
    }
  }

  // Chỉ giữ lại đường dẫn do server sinh ra, tránh lưu URL ngoài vào DB.
  const attachments = (body.attachments ?? []).filter((url) =>
    url.startsWith("/uploads/disputes/"),
  );

  const dispute = await Dispute.create({
    code: generateCode(),
    userId,
    sessionId: body.sessionId || undefined,
    transactionId: body.transactionId || undefined,
    plate,
    reason: body.reason,
    content: body.content,
    contactName: body.contactName,
    contactPhone: body.contactPhone,
    contactEmail: body.contactEmail,
    attachments,
  });

  // UC15 -> UC01: sinh incident để staff/admin tiếp nhận & xử lý.
  const incident = await Incident.create({
    type: "Khác",
    note: `[Khiếu nại ${dispute.code}] ${body.reason}: ${body.content.slice(0, 200)}`,
    plate,
    sessionId: body.sessionId || undefined,
    disputeId: dispute._id,
    createdBy: userId,
  });
  dispute.incidentId = incident._id;
  await dispute.save();

  await createNotification({
    title: "Khiếu nại mới từ khách hàng",
    content: `${dispute.code} — ${body.reason}${plate ? ` (xe ${plate})` : ""}`,
    targetRole: "admin",
  });
  await createNotification({
    title: "Đã tiếp nhận khiếu nại",
    content: `Khiếu nại ${dispute.code} đã được ghi nhận. Chúng tôi sẽ phản hồi trong 24 giờ.`,
    userId,
  });

  response.status(201).json({ dispute: serializeDispute(dispute) });
}

/** PATCH /api/disputes/:id — admin/staff cập nhật trạng thái xử lý. */
export async function updateDispute(request: Request, response: Response) {
  const body = z
    .object({
      status: z.enum(DISPUTE_STATUSES),
      resolutionNote: z.string().trim().max(1000).optional(),
    })
    .parse(request.body);

  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ message: "ID khiếu nại không hợp lệ." });
    return;
  }

  const dispute = await Dispute.findById(request.params.id);
  if (!dispute) {
    response.status(404).json({ message: "Không tìm thấy khiếu nại." });
    return;
  }

  dispute.status = body.status;
  if (body.resolutionNote) {
    dispute.resolutionNote = body.resolutionNote;
  }
  dispute.handledBy = new mongoose.Types.ObjectId(request.user!.id);
  if (body.status === "Đã xử lý" || body.status === "Từ chối") {
    dispute.handledAt = new Date();
  }
  await dispute.save();

  // Đồng bộ trạng thái sang incident của UC01.
  if (dispute.incidentId) {
    const incidentStatus =
      body.status === "Mới"
        ? "Mới"
        : body.status === "Đang xử lý"
          ? "Đang xử lý"
          : "Đã xử lý";
    await Incident.findByIdAndUpdate(dispute.incidentId, {
      status: incidentStatus,
      handledBy: request.user!.id,
      ...(incidentStatus === "Đã xử lý" ? { handledAt: new Date() } : {}),
    });
  }

  await createNotification({
    title: `Khiếu nại ${dispute.code}: ${body.status}`,
    content:
      body.resolutionNote ||
      `Trạng thái khiếu nại đã cập nhật thành "${body.status}".`,
    userId: dispute.userId.toString(),
  });

  response.json({ dispute: serializeDispute(dispute) });
}

/** DELETE /api/disputes/:id — khách huỷ khiếu nại khi chưa được xử lý. */
export async function cancelDispute(request: Request, response: Response) {
  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ message: "ID khiếu nại không hợp lệ." });
    return;
  }

  const dispute = await Dispute.findById(request.params.id);
  if (!dispute) {
    response.status(404).json({ message: "Không tìm thấy khiếu nại." });
    return;
  }
  if (dispute.userId.toString() !== request.user!.id) {
    response.status(403).json({ message: "Không có quyền huỷ khiếu nại này." });
    return;
  }
  if (dispute.status !== "Mới") {
    response
      .status(409)
      .json({ message: "Khiếu nại đang được xử lý, không thể huỷ." });
    return;
  }

  if (dispute.incidentId) {
    await Incident.findByIdAndDelete(dispute.incidentId);
  }
  await dispute.deleteOne();

  response.json({ ok: true });
}

/** POST /api/disputes/:id/messages — admin/staff/customer gửi tin nhắn trong hội thoại. */
export async function addDisputeMessage(request: Request, response: Response) {
  const body = z
    .object({
      content: z.string().trim().min(1).max(2000),
    })
    .parse(request.body);

  if (!mongoose.isValidObjectId(request.params.id)) {
    response.status(400).json({ message: "ID khiếu nại không hợp lệ." });
    return;
  }

  const dispute = await Dispute.findById(request.params.id);
  if (!dispute) {
    response.status(404).json({ message: "Không tìm thấy khiếu nại." });
    return;
  }

  const user = request.user!;
  // Khách chỉ được nhắn trong khiếu nại của mình.
  if (user.role === "customer" && dispute.userId.toString() !== user.id) {
    response.status(403).json({ message: "Không có quyền gửi tin nhắn." });
    return;
  }

  const user_doc = await User.findById(user.id).select(
    "name firstName lastName",
  );
  const senderName =
    user_doc?.name && ""
      ? user_doc.name
      : (user_doc?.name ?? user.id);

  dispute.messages.push({
    senderId: new mongoose.Types.ObjectId(user.id),
    senderRole: user.role as "customer" | "admin" | "staff",
    senderName,
    content: body.content,
  } as any);

  // Khi admin/staff trả lời, tự động chuyển trạng thái sang "Đang xử lý" nếu còn là Mới.
  if (user.role !== "customer" && dispute.status === "Mới") {
    dispute.status = "Đang xử lý";
    if (!dispute.handledBy) {
      dispute.handledBy = new mongoose.Types.ObjectId(user.id);
    }
  }

  await dispute.save();

  // Thông báo cho khách khi nhân viên/admin trả lời.
  if (user.role !== "customer") {
    await createNotification({
      title: `Phản hồi từ iPARK cho khiếu nại ${dispute.code}`,
      content: body.content.slice(0, 150),
      userId: dispute.userId.toString(),
    });
  }

  response.json({ dispute: serializeDispute(dispute) });
}

import { Request, Response } from "express";
import { z } from "zod";
import { RfidIssueRequest } from "../models/RfidIssueRequest.js";
import { RfidCard } from "../models/RfidCard.js";
import { Vehicle } from "../models/Vehicle.js";
import { Subscription } from "../models/Subscription.js";

const serialize = (item: any) => ({
  id: item._id.toString(),
  userId: item.userId?.toString(),
  vehicleId: item.vehicleId?.toString() ?? null,
  rfidCardId: item.rfidCardId?.toString(),
  uid: item.uid,
  type: item.type,
  description: item.description ?? "",
  status: item.status,
  managerNote: item.managerNote ?? "",
  handledAt: item.handledAt ?? null,
  createdAt: item.createdAt,
  card:
    item.rfidCardId && typeof item.rfidCardId === "object"
      ? {
          uid: item.rfidCardId.uid,
          cardId: item.rfidCardId.cardId,
          plate: item.rfidCardId.plate,
        }
      : null,
});

export async function listMyRfidIssues(request: Request, response: Response) {
  const items = await RfidIssueRequest.find({ userId: request.user!.id })
    .populate("rfidCardId", "uid cardId plate")
    .sort({ createdAt: -1 })
    .limit(50);
  response.json({ requests: items.map(serialize) });
}
export async function createRfidIssue(request: Request, response: Response) {
  const body = z
    .object({
      rfidCardId: z.string().min(1),
      type: z.enum(["lost", "damaged"]),
      description: z.string().trim().max(1000).optional(),
    })
    .parse(request.body);
  const card = await RfidCard.findById(body.rfidCardId);
  if (
    !card ||
    card.userId?.toString() !== request.user!.id ||
    card.cardType !== "member"
  ) {
    response
      .status(404)
      .json({ message: "Không tìm thấy thẻ RFID Member thuộc tài khoản." });
    return;
  }
  if (!["active", "in-use"].includes(card.status)) {
    response
      .status(409)
      .json({ message: "Thẻ RFID này không ở trạng thái có thể báo lỗi." });
    return;
  }
  const existing = await RfidIssueRequest.findOne({
    rfidCardId: card._id,
    status: { $in: ["pending", "processing"] },
  });
  if (existing) {
    response
      .status(409)
      .json({ message: "Thẻ này đang có yêu cầu chờ xử lý." });
    return;
  }
  const item = await RfidIssueRequest.create({
    userId: request.user!.id,
    vehicleId: card.vehicleId,
    rfidCardId: card._id,
    uid: card.uid,
    type: body.type,
    description: body.description,
  });
  if (body.type === "lost") {
    card.status = "lost";
    card.lostAt = new Date();
    card.blockedReason = body.description || "Thành viên báo mất thẻ";
    await card.save();
    await Subscription.updateMany(
      { rfidCardId: card._id },
      { $unset: { rfidCardId: 1 } },
    );
  } else if (body.type === "damaged") {
    card.status = "damaged";
    card.damagedAt = new Date();
    card.damagedReason = body.description || "Thành viên báo hỏng thẻ";
    await card.save();
    // Gỡ liên kết với gói dịch vụ để thành viên có thể được cấp thẻ thay thế.
    await Subscription.updateMany(
      { rfidCardId: card._id },
      { $unset: { rfidCardId: 1 } },
    );
  }
  response
    .status(201)
    .json({ request: serialize({ ...item.toObject(), rfidCardId: card }) });
}
export async function listRfidIssues(_request: Request, response: Response) {
  const items = await RfidIssueRequest.find()
    .populate("rfidCardId", "uid cardId plate")
    .sort({ createdAt: -1 })
    .limit(200);
  response.json({ requests: items.map(serialize) });
}
export async function updateRfidIssue(request: Request, response: Response) {
  const body = z
    .object({
      status: z.enum(["processing", "completed", "rejected"]),
      managerNote: z.string().trim().max(1000).optional(),
    })
    .parse(request.body);
  const item = await RfidIssueRequest.findById(request.params.id);
  if (!item) {
    response.status(404).json({ message: "Không tìm thấy yêu cầu RFID." });
    return;
  }
  if (item.status === "completed" || item.status === "rejected") {
    response
      .status(409)
      .json({
        message: "Yêu cầu RFID đã được xử lý, không thể chuyển trạng thái lại.",
      });
    return;
  }
  if (body.status === "rejected" && !body.managerNote) {
    response
      .status(400)
      .json({ message: "Cần nhập lý do khi từ chối yêu cầu RFID." });
    return;
  }
  item.status = body.status;
  item.managerNote = body.managerNote;
  item.handledBy = request.user!.id as any;
  item.handledAt = new Date();
  await item.save();
  response.json({ request: serialize(item) });
}

import { Request, Response } from "express";
import { z } from "zod";
import { Feedback } from "../models/Feedback.js";
import { createNotification } from "../services/notification.service.js";
import { serializeFeedback } from "../utils/serializers.js";

export async function listFeedback(request: Request, response: Response) {
  const criteria = request.user?.role === "customer" ? { createdBy: request.user.id } : {};
  const feedback = await Feedback.find(criteria).sort({ createdAt: -1 }).limit(200);
  response.json({ feedback: feedback.map(serializeFeedback) });
}

export async function createFeedback(request: Request, response: Response) {
  const body = z.object({ subject: z.string().min(2), content: z.string().min(2) }).parse(request.body);
  const feedback = await Feedback.create({
    ...body,
    createdBy: request.user?.id,
  });

  await createNotification({
    title: "Phản hồi mới",
    content: `${request.user?.email || "Khách hàng"} gửi phản hồi: ${body.subject}`,
    targetRole: "admin",
  });

  response.status(201).json({ feedback: serializeFeedback(feedback) });
}

export async function updateFeedback(request: Request, response: Response) {
  const body = z
    .object({
      status: z.enum(["Đang xử lý", "Đã phản hồi", "Đã đóng"]),
      response: z.string().optional(),
    })
    .parse(request.body);
  const feedback = await Feedback.findByIdAndUpdate(
    request.params.id,
    {
      ...body,
      handledBy: request.user?.id,
      handledAt: new Date(),
    },
    { new: true },
  );

  if (!feedback) {
    response.status(404).json({ message: "Không tìm thấy phản hồi." });
    return;
  }

  response.json({ feedback: serializeFeedback(feedback) });
}

import { Request, Response } from "express";
import { z } from "zod";
import { NotificationTemplate } from "../models/NotificationTemplate.js";

const triggerTypes = [
  "entry", "exit", "overdue", "low_balance", "promotion",
  "reservation_confirmed", "reservation_expired", "subscription_expiring", "custom",
] as const;

const templateSchema = z.object({
  name: z.string().min(2).max(100),
  triggerType: z.enum(triggerTypes),
  title: z.string().min(2).max(200),
  content: z.string().min(2),
  isActive: z.boolean().default(true),
});

export async function listTemplates(_request: Request, response: Response) {
  const templates = await NotificationTemplate.find().sort({ triggerType: 1, name: 1 });
  response.json({
    templates: templates.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      triggerType: t.triggerType,
      title: t.title,
      content: t.content,
      isActive: t.isActive,
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

export async function createTemplate(request: Request, response: Response) {
  const body = templateSchema.parse(request.body);
  const existing = await NotificationTemplate.findOne({ name: body.name });
  if (existing) {
    response.status(409).json({ message: `Template "${body.name}" đã tồn tại.` });
    return;
  }

  const template = await NotificationTemplate.create({
    ...body,
    createdBy: request.user?.id,
  });

  response.status(201).json({
    template: {
      id: template._id.toString(),
      name: template.name,
      triggerType: template.triggerType,
      title: template.title,
      content: template.content,
      isActive: template.isActive,
    },
  });
}

export async function updateTemplate(request: Request, response: Response) {
  const body = templateSchema.partial().parse(request.body);
  const template = await NotificationTemplate.findByIdAndUpdate(
    request.params.id,
    { $set: body },
    { returnDocument: "after" },
  );
  if (!template) {
    response.status(404).json({ message: "Template không tồn tại." });
    return;
  }

  response.json({
    template: {
      id: template._id.toString(),
      name: template.name,
      triggerType: template.triggerType,
      title: template.title,
      content: template.content,
      isActive: template.isActive,
    },
  });
}

export async function deleteTemplate(request: Request, response: Response) {
  const template = await NotificationTemplate.findByIdAndDelete(request.params.id);
  if (!template) {
    response.status(404).json({ message: "Template không tồn tại." });
    return;
  }
  response.json({ ok: true, message: "Đã xóa template." });
}

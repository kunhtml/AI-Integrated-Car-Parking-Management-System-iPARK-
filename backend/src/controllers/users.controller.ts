import { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { serializeUser } from "../utils/serializers.js";

export async function listUsers(_request: Request, response: Response) {
  const users = await User.find().sort({ createdAt: -1 }).limit(200);
  response.json({ users: users.map(serializeUser) });
}

export async function updateUser(request: Request, response: Response) {
  const body = z
    .object({
      id: z.string().min(1),
      role: z.enum(["admin", "staff", "customer"]).optional(),
      status: z.enum(["Đang hoạt động", "Đã khóa"]).optional(),
    })
    .parse(request.body);

  const updated = await User.findByIdAndUpdate(
    body.id,
    {
      ...(body.role ? { role: body.role } : {}),
      ...(body.status ? { status: body.status } : {}),
    },
    { new: true },
  );

  if (!updated) {
    response.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }

  response.json({ user: serializeUser(updated) });
}

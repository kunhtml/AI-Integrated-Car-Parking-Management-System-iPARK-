import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { PricingConfig } from "../models/PricingConfig.js";
import { serializePricingConfig } from "../utils/serializers.js";

const defaultPricingConfig = {
  id: "default",
  freeMinutes: 20,
  hourlyRate: 0,
  overnightRate: 0,
  monthlyRate: 0,
  overdueFineRate: 0,
  dailyMaxRate: 0,
  graceExitMinutes: 10,
  effectiveFrom: new Date().toISOString(),
  isActive: true,
  createdAt: null,
  updatedAt: null,
};

const pricingSchema = z.object({
  freeMinutes: z.number().min(0),
  hourlyRate: z.number().min(0),
  overnightRate: z.number().min(0),
  monthlyRate: z.number().min(0),
  overdueFineRate: z.number().min(0),
  dailyMaxRate: z.number().min(0),
  graceExitMinutes: z.number().min(0),
  effectiveFrom: z.coerce.date(),
  isActive: z.boolean(),
});

export async function getPricingConfig(_request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ pricingConfig: defaultPricingConfig });
    return;
  }

  const config = await PricingConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
  response.json({ pricingConfig: config ? serializePricingConfig(config) : defaultPricingConfig });
}

export async function updatePricingConfig(request: Request, response: Response) {
  const body = pricingSchema.parse(request.body);

  if (mongoose.connection.readyState !== 1) {
    response.json({
      pricingConfig: {
        ...defaultPricingConfig,
        ...body,
        effectiveFrom: body.effectiveFrom.toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: "Chưa kết nối DB, cấu hình được trả về ở chế độ tạm.",
    });
    return;
  }

  if (body.isActive) {
    await PricingConfig.updateMany({ isActive: true }, { $set: { isActive: false } });
  }

  const config = await PricingConfig.create({
    ...body,
    updatedBy: request.user?.id && mongoose.Types.ObjectId.isValid(request.user.id) ? request.user.id : undefined,
  });

  response.status(201).json({ pricingConfig: serializePricingConfig(config), message: "Đã lưu cấu hình phí." });
}

import mongoose from "mongoose";
import { Request, Response } from "express";
import { z } from "zod";
import { PricingConfig } from "../models/PricingConfig.js";
import { runAutomatedSystemProcess } from "../services/pricing.service.js";
import { serializePricingConfig } from "../utils/serializers.js";

const defaultPricingConfig = {
  id: "default",
  freeMinutes: 20,
  hourlyRate: 5000,
  overnightRate: 10000,
  dayStartHour: 6,
  nightStartHour: 22,
  monthlyRate: 1200000,
  overdueFineRate: 50000,
  dailyMaxRate: 120000,
  graceExitMinutes: 10,
  effectiveFrom: new Date().toISOString(),
  isActive: true,
  createdAt: null,
  updatedAt: null,
};

const pricingSchema = z.object({
  freeMinutes: z.number().min(0).default(20),
  hourlyRate: z.number().min(0).default(5000),
  overnightRate: z.number().min(0).default(10000),
  dayStartHour: z.number().min(0).max(23).default(6),
  nightStartHour: z.number().min(0).max(23).default(22),
  monthlyRate: z.number().min(0).default(1200000),
  overdueFineRate: z.number().min(0).default(50000),
  dailyMaxRate: z.number().min(0).default(120000),
  graceExitMinutes: z.number().min(0).default(10),
  effectiveFrom: z.coerce.date().default(() => new Date()),
  isActive: z.boolean().default(true),
});

export async function getPricingConfig(_request: Request, response: Response) {
  if (mongoose.connection.readyState !== 1) {
    response.json({ pricingConfig: defaultPricingConfig });
    return;
  }

  const config = await PricingConfig.findOne({ isActive: true }).sort({
    updatedAt: -1,
  });
  response.json({
    pricingConfig: config
      ? serializePricingConfig(config)
      : defaultPricingConfig,
  });
}

export async function updatePricingConfig(
  request: Request,
  response: Response,
) {
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
    await PricingConfig.updateMany(
      { isActive: true },
      { $set: { isActive: false } },
    );
  }

  const config = await PricingConfig.create({
    ...body,
    updatedBy:
      request.user?.id && mongoose.Types.ObjectId.isValid(request.user.id)
        ? request.user.id
        : undefined,
  });

  response
    .status(201)
    .json({
      pricingConfig: serializePricingConfig(config),
      message: "Đã lưu bảng giá thành công.",
    });
}

export async function runAutomatedProcessController(request: Request, response: Response) {
  const body = z
    .object({
      plate: z.string().optional(),
      ownerUserId: z.string().optional(),
      checkInAt: z.coerce.date(),
      checkOutAt: z.coerce.date(),
    })
    .parse(request.body);

  const result = await runAutomatedSystemProcess({
    plate: body.plate,
    ownerUserId: body.ownerUserId,
    checkInAt: body.checkInAt,
    checkOutAt: body.checkOutAt,
  });

  response.json({
    success: true,
    result,
  });
}

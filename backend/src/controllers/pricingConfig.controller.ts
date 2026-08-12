import { Request, Response } from "express";
import { z } from "zod";
import {
  getActivePricingConfig,
  updateActivePricingConfig,
} from "../services/pricing.service.js";

function serializePricingConfig(
  config: Awaited<ReturnType<typeof getActivePricingConfig>>,
) {
  return {
    id: config._id.toString(),
    dayRate: config.dayRate,
    rfidCardSalePrice: config.rfidCardSalePrice ?? 50000,
    nightRate: config.nightRate,
    dayStartHour: config.dayStartHour,
    nightStartHour: config.nightStartHour,
    gracePeriod: config.gracePeriod,
    maxMinutes: config.maxMinutes,
    isActive: config.isActive,
    updatedAt: config.updatedAt,
  };
}

const pricingConfigSchema = z
  .object({
    dayRate: z.coerce.number().int().min(1, "Giá ban ngày phải lớn hơn 0."),
    rfidCardSalePrice: z.coerce.number().int().min(0, "Giá thẻ RFID không được âm."),
    nightRate: z.coerce.number().int().min(1, "Giá ban đêm phải lớn hơn 0."),
    dayStartHour: z.coerce.number().int().min(0).max(23),
    nightStartHour: z.coerce.number().int().min(0).max(23),
    gracePeriod: z.coerce.number().int().min(0).optional(),
    maxMinutes: z.coerce.number().int().min(0).optional(),
  })
  .refine((v) => v.dayStartHour < v.nightStartHour, {
    message: "Giờ bắt đầu ngày phải nhỏ hơn giờ bắt đầu đêm.",
    path: ["nightStartHour"],
  });

export async function getPricingConfig(_request: Request, response: Response) {
  const config = await getActivePricingConfig();
  response.json({ pricingConfig: serializePricingConfig(config) });
}

export async function updatePricingConfig(
  request: Request,
  response: Response,
) {
  const body = pricingConfigSchema.parse(request.body);
  const config = await updateActivePricingConfig(body, request.user?.id);
  response.json({ pricingConfig: serializePricingConfig(config) });
}

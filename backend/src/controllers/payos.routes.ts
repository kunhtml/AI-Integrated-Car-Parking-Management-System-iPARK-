import { Router } from "express";
import { handlePayOSWebhook, handlePayOSReturn } from "../services/payos-webhook.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const payosRoutes = Router();

// PayOS Webhook - nhận thông báo thanh toán tự động (không cần auth)
payosRoutes.post("/webhook", asyncHandler(handlePayOSWebhook));

// PayOS Return URL - redirect về frontend sau khi thanh toán
payosRoutes.get("/return", asyncHandler(handlePayOSReturn));

import { Router } from "express";
import {
  cancelHandler,
  createPlanHandler,
  deletePlanHandler,
  deleteSubscriptionHandler,
  getPaymentInfoHandler,
  listPlansHandler,
  listSubscriptionsHandler,
  mySubscriptionsHandler,
  purchaseHandler,
  renewHandler,
  subscriptionPaymentStatusHandler,
  updatePlanHandler,
  verifyMemberCodeHandler,
} from "../controllers/subscriptions.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const subscriptionsRoutes = Router();

// Plans
subscriptionsRoutes.get("/plans", requireAuth, asyncHandler(listPlansHandler));
subscriptionsRoutes.post("/plans", requireAuth, requireRole("admin"), asyncHandler(createPlanHandler));
subscriptionsRoutes.put("/plans/:id", requireAuth, requireRole("admin"), asyncHandler(updatePlanHandler));
subscriptionsRoutes.delete("/plans/:id", requireAuth, requireRole("admin"), asyncHandler(deletePlanHandler));

// Subscriptions
subscriptionsRoutes.get("/", requireAuth, requireRole("admin"), asyncHandler(listSubscriptionsHandler));
subscriptionsRoutes.get("/my", requireAuth, asyncHandler(mySubscriptionsHandler));
subscriptionsRoutes.post("/", requireAuth, asyncHandler(purchaseHandler));
subscriptionsRoutes.post("/verify-member", requireAuth, asyncHandler(verifyMemberCodeHandler));
subscriptionsRoutes.get("/:id/payment-status", requireAuth, asyncHandler(subscriptionPaymentStatusHandler));
subscriptionsRoutes.get("/:id/payment-info", requireAuth, asyncHandler(getPaymentInfoHandler));
subscriptionsRoutes.post("/:id/renew", requireAuth, asyncHandler(renewHandler));
subscriptionsRoutes.post("/:id/cancel", requireAuth, asyncHandler(cancelHandler));
subscriptionsRoutes.delete("/:id", requireAuth, requireRole("admin"), asyncHandler(deleteSubscriptionHandler));

// Lưu ý: đã xoá các route `/:id/vehicles` và `/:id/plates` sau khi chuyển sang mô hình 1 gói = 1 xe.
// Vehicle giờ được gắn qua trường `primaryVehicleId` ngay lúc mua gói (POST /).

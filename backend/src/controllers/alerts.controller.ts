import { Request, Response } from "express";
import { getCapacityStatus, checkCapacityAlerts } from "../services/capacityAlert.service.js";
import {
  checkExpiringSubscriptions,
  checkExpiredSubscriptions,
} from "../services/subscriptionWarning.service.js";

/**
 * GET /api/alerts/capacity
 * Return current parking capacity status (any authenticated user).
 */
export async function getCapacityStatusHandler(
  _request: Request,
  response: Response,
) {
  const status = await getCapacityStatus();
  response.json(status);
}

/**
 * POST /api/alerts/check
 * Manually trigger all alert checks (subscription + capacity). Admin only.
 */
export async function checkAlertsHandler(
  _request: Request,
  response: Response,
) {
  const [subscriptionExpiring, subscriptionExpired, capacity] =
    await Promise.all([
      checkExpiringSubscriptions(),
      checkExpiredSubscriptions(),
      checkCapacityAlerts(),
    ]);

  response.json({
    message: "Đã kiểm tra tất cả cảnh báo.",
    subscriptionExpiring,
    subscriptionExpired,
    capacity,
  });
}

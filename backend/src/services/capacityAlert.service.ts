import { ParkingSession } from "../models/ParkingSession.js";
import { Notification } from "../models/Notification.js";
import { createNotification } from "./notification.service.js";
import { parkingConfig } from "../config/parking.js";

/**
 * UC57 - Proactive Capacity Warning
 *
 * Check current parking occupancy and create notifications for admins
 * when capacity exceeds thresholds (>80% = capacity-warning, >90% = warning).
 * Avoids duplicate notifications by checking if one was already sent in the last hour.
 */
export async function checkCapacityAlerts(): Promise<{
  occupancy: number;
  activeCount: number;
  totalCapacity: number;
  alertSent: boolean;
}> {
  const { totalCapacity } = parkingConfig;

  const activeCount = await ParkingSession.countDocuments({
    status: "Đang gửi",
  });

  const occupancy = Math.round((activeCount / totalCapacity) * 100 * 100) / 100;
  let alertSent = false;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentAlert = await Notification.findOne({
    type: { $in: ["capacity-warning", "warning"] },
    targetRole: "admin",
    createdAt: { $gte: oneHourAgo },
  });

  if (!recentAlert && occupancy > 90) {
    await createNotification({
      title: "Cảnh báo: Bãi đỗ xe gần đầy",
      content: `Mức sử dụng bãi đỗ xe đã đạt ${occupancy}% (${activeCount}/${totalCapacity} chỗ). Cần ưu tiên xe thành viên và hạn chế xe vãng lai.`,
      type: "warning",
      targetRole: "admin",
    });
    alertSent = true;
  } else if (!recentAlert && occupancy > 80) {
    await createNotification({
      title: "Thông báo: Bãi đỗ xe đang đông",
      content: `Mức sử dụng bãi đỗ xe đã đạt ${occupancy}% (${activeCount}/${totalCapacity} chỗ). Vui lòng theo dõi tình hình.`,
      type: "capacity-warning",
      targetRole: "admin",
    });
    alertSent = true;
  }

  return { occupancy, activeCount, totalCapacity, alertSent };
}

/**
 * UC57 - Proactive Capacity Warning
 *
 * Return current capacity information without creating notifications.
 */
export async function getCapacityStatus(): Promise<{
  activeCount: number;
  totalCapacity: number;
  available: number;
  occupancyPercent: number;
  alertLevel: "normal" | "warning" | "critical";
}> {
  const { totalCapacity } = parkingConfig;

  const activeCount = await ParkingSession.countDocuments({
    status: "Đang gửi",
  });

  const available = totalCapacity - activeCount;
  const occupancyPercent =
    Math.round((activeCount / totalCapacity) * 100 * 100) / 100;

  let alertLevel: "normal" | "warning" | "critical" = "normal";
  if (occupancyPercent > 90) {
    alertLevel = "critical";
  } else if (occupancyPercent > 80) {
    alertLevel = "warning";
  }

  return { activeCount, totalCapacity, available, occupancyPercent, alertLevel };
}

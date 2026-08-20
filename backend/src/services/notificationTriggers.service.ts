import { createNotification, createNotificationsForRoles } from "./notification.service.js";

/**
 * CU-22: Notify user on successful registration.
 */
export async function notifyRegistration(userId: string, name: string) {
  await createNotification({
    title: "Chào mừng đến iPARK!",
    content: `Xin chào ${name}, tài khoản của bạn đã được tạo thành công. Chúc bạn có trải nghiệm tốt!`,
    userId,
  });
}

/**
 * CU-23: Notify user on checkout (exit).
 * Already triggered in parkingSessions controller — this is for explicit use.
 */
export async function notifyCheckout(userId: string, plate: string, fee: number) {
  await createNotification({
    title: "Xe đã ra bãi",
    content: `Xe ${plate} đã checkout. Phí: ${fee.toLocaleString("vi-VN")} VND.`,
    userId,
  });
}

/**
 * CU-24: Notify user about overdue penalty.
 */
export async function notifyPenalty(userId: string, plate: string, overdueMinutes: number, fineAmount: number) {
  await createNotification({
    title: "Phạt quá hạn đỗ xe",
    content: `Xe ${plate} đã quá hạn ${overdueMinutes} phút. Phí phạt: ${fineAmount.toLocaleString("vi-VN")} VND.`,
    userId,
  });
}

/**
 * CU-26: Send promotional notification to all customers.
 */
export async function notifyPromotion(title: string, content: string) {
  await createNotificationsForRoles({
    title,
    content,
    roles: ["customer"],
  });
}

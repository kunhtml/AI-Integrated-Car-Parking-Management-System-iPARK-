import { ParkingSession } from "../models/ParkingSession.js";
import { User } from "../models/User.js";
import { Vehicle } from "../models/Vehicle.js";
import { sendMail } from "./mail.service.js";
import { createNotification } from "./notification.service.js";

/**
 * Send reminder email 30 minutes before parking expiry
 * Called by scheduler every 5 minutes
 */
export async function sendExpiryReminders() {
  const WARNING_MINUTES = 30; // Send reminder 30 minutes before expiry
  const warningThreshold = new Date(Date.now() + WARNING_MINUTES * 60 * 1000);
  
  // Find active sessions that are approaching expiry
  // Sessions with isOverstayed flag that haven't been reminded yet
  const sessions = await ParkingSession.find({
    status: "Đang gửi",
    isOverstayed: true,
    paymentStatus: { $nin: ["fully_paid"] },
  }).populate("ownerUserId");

  let sentCount = 0;

  for (const session of sessions) {
    // Skip if already reminded recently (within last 30 minutes)
    const lastReminder = (session as any).lastReminderAt;
    if (lastReminder) {
      const timeSinceReminder = Date.now() - new Date(lastReminder).getTime();
      if (timeSinceReminder < 30 * 60 * 1000) {
        continue;
      }
    }

    // Get user email
    let email: string | null = null;
    let phone: string | null = null;
    
    if (session.ownerUserId) {
      const user = session.ownerUserId as any;
      email = user.email || null;
      phone = user.phone || null;
    }

    // Get vehicle email if user email not available
    if (!email) {
      const vehicle = await Vehicle.findOne({ plate: session.plate });
      email = vehicle?.ownerEmail ?? null;
      phone = phone ?? vehicle?.ownerPhone ?? null;
    }

    if (!email) {
      continue;
    }

    // Calculate additional fee for 30 more minutes
    const additionalMinutes = 30;
    const extraFee = Math.ceil(additionalMinutes * (8000 / 60)); // 8000/hour = ~133/minute

    // Send email reminder
    const subject = `[iPARK] Cảnh báo: Xe ${session.plate} sắp hết thời gian gửi`;
    const text = `
Xin chào,

Xe của bạn với biển số ${session.plate} đang gửi tại bãi xe iPARK.

⚠️ Thông báo: Xe của bạn sắp hết thời gian gửi và sẽ bị tính phí quá giờ.

📍 Vị trí: ${session.slot}
⏰ Thời gian vào: ${new Date(session.checkInAt).toLocaleString("vi-VN")}
💰 Phí gửi xe hiện tại: ${session.fee.toLocaleString("vi-VN")}đ
💰 Phí gia hạn thêm ${additionalMinutes} phút: ${extraFee.toLocaleString("vi-VN")}đ

🔗 Để gia hạn thêm thời gian, vui lòng truy cập:
https://ipark.vn/tra-cuu?plate=${encodeURIComponent(session.plate)}

Nếu bạn đã thanh toán, vui lòng bỏ qua email này.

Trân trọng,
iPARK - Bãi đỗ xe thông minh
Hotline: 1900 1234
    `.trim();

    await sendMail(email, subject, text);

    // Update last reminder timestamp
    (session as any).lastReminderAt = new Date();
    await session.save();

    // Create in-app notification
    if (session.ownerUserId) {
      await createNotification({
        userId: (session.ownerUserId as any)._id?.toString() || session.ownerUserId.toString(),
        title: "Cảnh báo sắp hết giờ gửi xe",
        content: `Xe ${session.plate} sắp hết thời gian gửi. Phí gia hạn thêm 30 phút: ${extraFee.toLocaleString("vi-VN")}đ`,
      });
    }

    sentCount++;
  }

  return sentCount;
}

/**
 * Send pre-checkout reminder to users who prepaid but haven't exited
 * Called by scheduler every 5 minutes
 */
export async function sendPrepaidReminders() {
  const WARNING_HOURS = 2; // Remind if prepaid but still in parking after 2 hours
  
  const sessions = await ParkingSession.find({
    status: "Đang gửi",
    paymentStatus: "fully_paid",
  }).populate("ownerUserId");

  let sentCount = 0;

  for (const session of sessions) {
    const paidAt = session.updatedAt;
    const hoursSincePayment = (Date.now() - paidAt.getTime()) / (1000 * 60 * 60);

    // Only remind if paid more than 2 hours ago and not reminded recently
    if (hoursSincePayment < WARNING_HOURS) continue;

    const lastReminder = (session as any).lastPrepaidReminderAt;
    if (lastReminder) {
      const timeSinceReminder = Date.now() - new Date(lastReminder).getTime();
      if (timeSinceReminder < 60 * 60 * 1000) {
        continue; // Only remind once per hour
      }
    }

    // Get user email
    let email: string | null = null;
    if (session.ownerUserId) {
      const user = session.ownerUserId as any;
      email = user.email || null;
    }

    if (!email) {
      const vehicle = await Vehicle.findOne({ plate: session.plate });
      email = vehicle?.ownerEmail ?? null;
    }

    if (!email) continue;

    const subject = `[iPARK] Nhắc nhở: Xe ${session.plate} vẫn đang trong bãi`;
    const text = `
Xin chào,

Xe của bạn với biển số ${session.plate} đã thanh toán nhưng vẫn đang trong bãi xe iPARK.

⏰ Thời gian đã thanh toán: ${paidAt.toLocaleString("vi-VN")}
📍 Vị trí: ${session.slot}

Bạn có thể ra bất kỳ lúc nào - barie sẽ tự động mở khi nhận diện biển số.

Nếu bạn cần gia hạn thêm thời gian, vui lòng truy cập:
https://ipark.vn/tra-cuu?plate=${encodeURIComponent(session.plate)}

Trân trọng,
iPARK
    `.trim();

    await sendMail(email, subject, text);

    // Update reminder timestamp
    (session as any).lastPrepaidReminderAt = new Date();
    await session.save();

    sentCount++;
  }

  return sentCount;
}

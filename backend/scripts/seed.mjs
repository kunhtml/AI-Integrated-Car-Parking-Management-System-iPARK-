import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { User } from "../src/models/User.js";
import { Vehicle } from "../src/models/Vehicle.js";
import { Device } from "../src/models/Device.js";
import { Dispute } from "../src/models/Dispute.js";
import { Notification } from "../src/models/Notification.js";
import { NotificationTemplate } from "../src/models/NotificationTemplate.js";
import { PaymentConfig } from "../src/models/PaymentConfig.js";
import { PricingConfig } from "../src/models/PricingConfig.js";
import { SubscriptionPlan } from "../src/models/SubscriptionPlan.js";
import { Zone } from "../src/models/Zone.js";
import { ParkingSlot } from "../src/models/ParkingSlot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("[Seed] MONGODB_URI is not set in environment. Abort.");
  process.exit(1);
}
console.log("[Seed] MONGODB_URI found.");

await mongoose.connect(uri);
console.log("[Seed] Connected to MongoDB.");

// ─── 1. Users ───────────────────────────────────────────────────────────────
const seedUsers = [
  {
    name: process.env.ADMIN_NAME || "Super Admin iPARK",
    email: process.env.ADMIN_EMAIL || "admin@ipark.vn",
    password: process.env.ADMIN_PASSWORD || "admin",
    role: "admin",
  },
  {
    name: process.env.STAFF_1_NAME || "Nhân viên cổng 1",
    email: process.env.STAFF_1_EMAIL || "nv.1@ipark.vn",
    password: process.env.STAFF_1_PASSWORD || "123456",
    role: "staff",
  },
  {
    name: process.env.STAFF_2_NAME || "Nhân viên cổng 2",
    email: process.env.STAFF_2_EMAIL || "nv.2@ipark.vn",
    password: process.env.STAFF_2_PASSWORD || "123456",
    role: "staff",
  },
  {
    name: process.env.STAFF_3_NAME || "Nhân viên cổng 3",
    email: process.env.STAFF_3_EMAIL || "nv.3@ipark.vn",
    password: process.env.STAFF_3_PASSWORD || "123456",
    role: "staff",
  },
  {
    name: process.env.CUSTOMER_1_NAME || "Nguyễn Văn Khách",
    email: process.env.CUSTOMER_1_EMAIL || "customer1@ipark.vn",
    password: process.env.CUSTOMER_1_PASSWORD || "123456",
    role: "customer",
  },
];

let usersUpserted = 0;
for (const user of seedUsers) {
  const passwordHash = await bcrypt.hash(user.password, 12);
  const result = await User.updateOne(
    { email: user.email.toLowerCase() },
    {
      $set: {
        name: user.name,
        email: user.email.toLowerCase(),
        passwordHash,
        role: user.role,
        status: "Đang hoạt động",
        provider: "credentials",
        twoFactorEnabled: false,
        isVerified: true,
      },
    },
    { upsert: true },
  );
  if (result.upsertedCount > 0) usersUpserted++;
}
console.log(`[Seed] Users: ${usersUpserted} created, ${seedUsers.length - usersUpserted} updated.`);

// ─── 2. Vehicles ────────────────────────────────────────────────────────────
const seedVehicles = [
  {
    plate: "30H-678.90",
    ownerName: "Khách iPARK 01",
    ownerEmail: "khach01@example.com",
    ownerPhone: "0901234567",
    vehicleType: "Ô tô",
    status: "Đã đăng ký",
    isCompanyVehicle: false,
  },
  {
    plate: "30F-222.11",
    ownerName: "Khách iPARK 02",
    ownerEmail: "khach02@example.com",
    ownerPhone: "0907654321",
    vehicleType: "Ô tô",
    status: "Đã đăng ký",
    isCompanyVehicle: false,
  },
  {
    plate: "30K-999.99",
    ownerName: "Xe blacklist",
    vehicleType: "Ô tô",
    status: "Blacklist",
    isCompanyVehicle: false,
  },
];

let vehiclesUpserted = 0;
for (const vehicle of seedVehicles) {
  const result = await Vehicle.updateOne(
    { plate: vehicle.plate },
    { $set: vehicle },
    { upsert: true },
  );
  if (result.upsertedCount > 0) vehiclesUpserted++;
}
console.log(`[Seed] Vehicles: ${vehiclesUpserted} created, ${seedVehicles.length - vehiclesUpserted} updated.`);

// ─── 3. PricingConfig (schema day/night) ────────────────────────────────────
await PricingConfig.updateOne(
  { isActive: true },
  {
    $set: {
      dayRate: 5000,
      nightRate: 10000,
      dayStartHour: 6,
      nightStartHour: 22,
      gracePeriod: 20,
      maxMinutes: 1440,
      isActive: true,
    },
  },
  { upsert: true },
);
console.log("[Seed] PricingConfig seeded (day/night rate model).");

// ─── 4. PaymentConfig (PayOS — checksumKey đã bỏ, dùng env) ────────────────
const payosClientId = process.env.PAYOS_CLIENT_ID;
const payosApiKey = process.env.PAYOS_API_KEY;

await PaymentConfig.updateOne(
  { isActive: true },
  {
    $set: {
      isActive: true,
      payosEnabled: Boolean(payosClientId && payosApiKey),
      payosClientId: payosClientId || undefined,
      payosApiKey: payosApiKey || undefined,
    },
  },
  { upsert: true },
);
console.log(`[Seed] PaymentConfig seeded (PayOS enabled: ${Boolean(payosClientId && payosApiKey)}).`);

// ─── 5. Devices ─────────────────────────────────────────────────────────────
await Device.updateOne(
  { gate: "entry" },
  {
    $set: {
      name: "Camera cổng vào",
      gate: "entry",
      rtspUrl: process.env.RTSP_ENTRY_URL || "rtsp://example.local/entry",
      username: process.env.RTSP_ENTRY_USERNAME || "",
      password: process.env.RTSP_ENTRY_PASSWORD || "",
      status: "unknown",
      healthCheckEnabled: true,
      offlineThresholdMinutes: 30,
    },
  },
  { upsert: true },
);

await Device.updateOne(
  { gate: "exit" },
  {
    $set: {
      name: "Camera cổng ra",
      gate: "exit",
      rtspUrl: process.env.RTSP_EXIT_URL || "rtsp://example.local/exit",
      username: process.env.RTSP_EXIT_USERNAME || "",
      password: process.env.RTSP_EXIT_PASSWORD || "",
      status: "unknown",
      healthCheckEnabled: true,
      offlineThresholdMinutes: 30,
    },
  },
  { upsert: true },
);
console.log("[Seed] Devices seeded.");

// ─── 6. NotificationTemplate (seed 5 templates tiếng Việt) ──────────────────
const seedTemplates = [
  {
    name: "Xe vào bãi",
    triggerType: "entry",
    title: "Xe đã vào bãi",
    content: "Xe {plate} đã vào bãi {slot}. Vui lòng giữ biên lai.",
    isActive: true,
  },
  {
    name: "Xe ra bãi",
    triggerType: "exit",
    title: "Xe đã ra bãi",
    content: "Xe {plate} đã rời bãi {slot}. Tổng phí {fee} VND.",
    isActive: true,
  },
  {
    name: "Cảnh báo quá hạn",
    triggerType: "overdue",
    title: "Cảnh báo quá hạn",
    content: "Xe {plate} đã quá hạn {minutes} phút. Phí phạt {fine} VND.",
    isActive: true,
  },
  {
    name: "Chào mừng thành viên mới",
    triggerType: "custom",
    title: "Chào mừng đến iPARK!",
    content: "Cảm ơn bạn đã đăng ký. Mã thành viên: {memberCode}.",
    isActive: true,
  },
  {
    name: "Khuyến mãi",
    triggerType: "promotion",
    title: "Ưu đãi đặc biệt",
    content: "Giảm giá 20% cho thành viên mới trong tháng này.",
    isActive: true,
  },
];
let templatesUpserted = 0;
for (const tpl of seedTemplates) {
  const result = await NotificationTemplate.updateOne(
    { name: tpl.name },
    { $set: tpl },
    { upsert: true },
  );
  if (result.upsertedCount > 0) templatesUpserted++;
}
console.log(`[Seed] NotificationTemplates: ${templatesUpserted} created, ${seedTemplates.length - templatesUpserted} updated.`);

// ─── 7. Notification (welcome banner) ───────────────────────────────────────
await Notification.updateOne(
  { title: "Chào mừng iPARK" },
  {
    $set: {
      title: "Chào mừng iPARK",
      content: "Hệ thống đã sẵn sàng cho demo local.",
      targetRole: "all",
      readBy: [],
    },
  },
  { upsert: true },
);
console.log("[Seed] Notification seeded.");

// Seed notifications for customer1 (1 read, 2 unread for CUS_12 and CUS_13)
const customer1User = await User.findOne({ email: "customer1@ipark.vn" });
if (customer1User) {
  const customerNotifs = [
    {
      title: "Chào mừng quý khách đến với iPARK",
      content: "Tài khoản của bạn đã được kích hoạt thành công. Hãy trải nghiệm dịch vụ đỗ xe thông minh!",
      targetRole: "customer",
      userId: customer1User._id,
      readBy: [customer1User._id],
    },
    {
      title: "Đặt chỗ đỗ xe thành công",
      content: "Bạn đã đặt chỗ A-01 thành công từ 08:00 đến 12:00 hôm nay.",
      targetRole: "customer",
      userId: customer1User._id,
      readBy: [],
    },
    {
      title: "Ưu đãi thành viên mới",
      content: "Giảm 20% cho lần nạp tiền ví đầu tiên trong tháng này. Nạp ngay để nhận ưu đãi!",
      targetRole: "customer",
      userId: customer1User._id,
      readBy: [],
    },
  ];

  for (const item of customerNotifs) {
    await Notification.updateOne(
      { title: item.title, userId: item.userId },
      { $set: item },
      { upsert: true }
    );
  }
  console.log("[Seed] Customer1 sample notifications seeded (1 read, 2 unread).");
}

// ─── 8. Zones ───────────────────────────────────────────────────────────────
const seedZones = [
  {
    name: "A",
    description: "Khu đỗ thông thường",
    capacity: 10,
    allowedVehicleTypes: ["Ô tô"],
    displayOrder: 1,
    isActive: true,
  },
  {
    name: "B",
    description: "Khu đỗ hỗn hợp (thường + điện)",
    capacity: 10,
    allowedVehicleTypes: ["Ô tô"],
    displayOrder: 2,
    isActive: true,
  },
  {
    name: "C",
    description: "Khu đỗ có mái che + dành cho người khuyết tật",
    capacity: 10,
    allowedVehicleTypes: ["Ô tô"],
    displayOrder: 3,
    isActive: true,
  },
];

const zoneIds = {};
for (const zone of seedZones) {
  const doc = await Zone.findOneAndUpdate(
    { name: zone.name },
    { $setOnInsert: zone },
    { upsert: true, returnDocument: "after" },
  );
  zoneIds[zone.name] = doc._id;
}
console.log(`[Seed] Zones: ${seedZones.length} seeded.`);

// ─── 9. ParkingSlots — chỉ tạo khi DB chưa có slot nào; mã số thuần (1, 2, 3...)
let slotsCreated = 0;
const existingSlotCount = await ParkingSlot.countDocuments();
if (existingSlotCount === 0) {
  const seedSlots = Array.from({ length: 30 }, (_, i) => ({
    slotCode: String(i + 1),
    zoneId: zoneIds.A,
    slotType: "regular",
    features: [],
    floor: 0,
    status: "empty",
  }));
  await ParkingSlot.insertMany(seedSlots);
  slotsCreated = seedSlots.length;
}
console.log(
  `[Seed] Slots: ${slotsCreated} created, ${existingSlotCount} already existed.`,
);

// ─── 10. SubscriptionPlans (3 plans, maxVehicles=null nghĩa là không giới hạn) ──
const seedPlans = [
  {
    name: "Gói tháng",
    description: "Gói 1 tháng — không giới hạn biển số",
    duration: "monthly",
    durationDays: 30,
    price: 1200000,
    maxVehicles: null,
    isActive: true,
  },
  {
    name: "Gói quý",
    description: "Gói 3 tháng — không giới hạn biển số",
    duration: "quarterly",
    durationDays: 90,
    price: 3300000,
    maxVehicles: null,
    isActive: true,
  },
  {
    name: "Gói năm",
    description: "Gói 12 tháng — không giới hạn biển số, ưu đãi 10%",
    duration: "yearly",
    durationDays: 365,
    price: 12000000,
    maxVehicles: null,
    isActive: true,
  },
];
let plansUpserted = 0;
for (const plan of seedPlans) {
  const result = await SubscriptionPlan.updateOne(
    { name: plan.name },
    { $set: plan },
    { upsert: true },
  );
  if (result.upsertedCount > 0) plansUpserted++;
}
console.log(`[Seed] SubscriptionPlans: ${plansUpserted} created, ${seedPlans.length - plansUpserted} updated.`);

// ─── 11. PenaltyConfigs — over_line (mặc định) ─────────────────────────────
await mongoose.connection.db.collection("penaltyconfigs").updateOne(
  { violationType: "over_line" },
  {
    $set: {
      violationType: "over_line",
      label: "Đỗ lấn vạch",
      amount: 200000,
      description: "Phạt khi xe đỗ lấn qua vạch quy định.",
      isActive: true,
    },
  },
  { upsert: true },
);
console.log("[Seed] PenaltyConfig over_line seeded.");

// ─── 12. Migration: vietqr → payos (giữ lại cho data cũ) ───────────────────
const txCollection = mongoose.connection.db.collection("transactions");
const migratedCount = await txCollection.countDocuments({ method: "vietqr" });
if (migratedCount > 0) {
  const result = await txCollection.updateMany(
    { method: "vietqr" },
    { $set: { method: "payos" } },
  );
  console.log(`[Migration] Updated ${result.modifiedCount} transactions from "vietqr" to "payos".`);
} else {
  console.log("[Migration] No transactions with method 'vietqr' found. Skipped.");
}

// ─── 13. Disputes gán cho nhân viên le492381@gmail.com ─────────────────────
const assignedStaff = await User.findOne({ email: "le492381@gmail.com" });
const disputeCustomer = await User.findOne({ email: "khach01@ipark.vn" });

if (assignedStaff && disputeCustomer) {
  const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

  const seedDisputes = [
    {
      code: "KN-SEED-0001",
      userId: disputeCustomer._id,
      assignedStaffId: assignedStaff._id,
      plate: "30H-678.90",
      reason: "Sai phí gửi xe",
      content:
        "Tôi gửi xe từ 8:00 đến 9:30 nhưng hệ thống tính phí 3 tiếng. Nhờ ban quản lý kiểm tra lại giúp tôi.",
      contactName: disputeCustomer.name,
      contactPhone: "0901234567",
      contactEmail: disputeCustomer.email,
      status: "Mới",
      createdAt: hoursAgo(5),
      messages: [],
    },
    {
      code: "KN-SEED-0002",
      userId: disputeCustomer._id,
      assignedStaffId: assignedStaff._id,
      plate: "30F-222.11",
      reason: "Nhận dạng biển số sai",
      content:
        "Khi ra bãi camera nhận dạng sai biển số thành xe khác, dẫn đến không cho ra. Đề nghị xác minh.",
      contactName: disputeCustomer.name,
      contactPhone: "0901234567",
      contactEmail: disputeCustomer.email,
      status: "Đang xử lý",
      createdAt: hoursAgo(30),
      messages: [
        {
          senderId: disputeCustomer._id,
          senderRole: "customer",
          senderName: disputeCustomer.name,
          content: "Tôi đã đính kèm ảnh biên lai, mong sớm được giải quyết.",
          createdAt: hoursAgo(26),
        },
        {
          senderId: assignedStaff._id,
          senderRole: "staff",
          senderName: assignedStaff.name,
          content:
            "Dạ em tiếp nhận rồi, đang đối chiếu log camera cổng ra, sẽ phản hồi trong hôm nay ạ.",
          createdAt: hoursAgo(24),
        },
      ],
    },
    {
      code: "KN-SEED-0003",
      userId: disputeCustomer._id,
      assignedStaffId: assignedStaff._id,
      plate: "30H-678.90",
      reason: "Thanh toán trùng / chưa ghi nhận",
      content:
        "Tôi đã thanh toán qua ví nhưng hệ thống vẫn báo chưa thu phí và giữ barie không cho ra.",
      contactName: disputeCustomer.name,
      contactPhone: "0901234567",
      contactEmail: disputeCustomer.email,
      status: "Đã xử lý",
      createdAt: hoursAgo(52),
      resolutionNote:
        "Đối chiếu thành công giao dịch ví (txn trùng lặp do bấm 2 lần). Đã hoàn tiền và mở barie cho khách.",
      handledBy: assignedStaff._id,
      handledAt: hoursAgo(48),
      messages: [
        {
          senderId: assignedStaff._id,
          senderRole: "staff",
          senderName: assignedStaff.name,
          content:
            "Dạ bên em đã kiểm tra và hoàn tiền giao dịch trùng, khách thông cảm ạ.",
          createdAt: hoursAgo(48),
        },
      ],
    },
  ];

  let disputesCreated = 0;
  for (const dispute of seedDisputes) {
    const result = await Dispute.updateOne(
      { code: dispute.code },
      { $setOnInsert: dispute },
      { upsert: true },
    );
    if (result.upsertedCount > 0) disputesCreated++;
  }
  console.log(
    `[Seed] Disputes: ${disputesCreated} created, ${seedDisputes.length - disputesCreated} already existed (assigned to ${assignedStaff.name}).`,
  );
} else {
  console.log(
    "[Seed] Disputes skipped: staff le492381@gmail.com hoặc customer khach01@ipark.vn không tồn tại.",
  );
}

await mongoose.disconnect();
console.log("[Seed] Done. Disconnected.");

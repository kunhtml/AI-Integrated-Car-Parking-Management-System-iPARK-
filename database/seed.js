// ============================================================
//  iPARK - MongoDB Shell Seed Script
//  Chạy bằng lệnh:
//    mongosh mongodb://127.0.0.1:27017/ipark seed.js
//  Hoặc paste trực tiếp vào MongoDB Compass > mongosh tab
// ============================================================

const DB_NAME = "ipark";
db = db.getSiblingDB(DB_NAME);

// ── Bcrypt hash (cost=10) ────────────────────────────────────
//   "admin"  → ADMIN_HASH
//   "123456" → STAFF_HASH
const ADMIN_HASH =
  "$2b$10$4CklnmzYnxrhQzZColOoxOE/SWhs3BZPWrpRtiMqH0R4S2Gl8Zele";
const STAFF_HASH =
  "$2b$10$4CklnmzYnxrhQzZColOoxORp.ImJ.N4nL35uv2J6m33u78Xtn3LtS";

const now = new Date();

// ============================================================
//  1. USERS
// ============================================================
db.users.drop();

const adminId = new ObjectId();
const staff1Id = new ObjectId();
const staff2Id = new ObjectId();
const custId = new ObjectId();

db.users.insertMany([
  {
    _id: adminId,
    name: "Super Admin iPARK",
    email: "admin@ipark.vn",
    passwordHash: ADMIN_HASH,
    role: "admin",
    status: "Đang hoạt động",
    wallet: 0,
    provider: "credentials",
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: staff1Id,
    name: "Nhân viên cổng 1",
    email: "nv.1@ipark.vn",
    passwordHash: STAFF_HASH,
    role: "staff",
    status: "Đang hoạt động",
    wallet: 0,
    provider: "credentials",
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: staff2Id,
    name: "Nhân viên cổng 2",
    email: "nv.2@ipark.vn",
    passwordHash: STAFF_HASH,
    role: "staff",
    status: "Đang hoạt động",
    wallet: 0,
    provider: "credentials",
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: custId,
    name: "Khách hàng mẫu",
    email: "kh.1@gmail.com",
    passwordHash: STAFF_HASH,
    role: "customer",
    status: "Đang hoạt động",
    wallet: 500000,
    provider: "credentials",
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
  },
]);
print(" users: " + db.users.countDocuments() + " documents");

// ============================================================
//  2. PRICING CONFIG
// ============================================================
db.pricingconfigs.drop();
db.pricingconfigs.insertOne({
  freeMinutes: 20,
  hourlyRate: 10000,
  overnightRate: 50000,
  monthlyRate: 1500000,
  overdueFineRate: 20000,
  dailyMaxRate: 100000,
  graceExitMinutes: 10,
  isActive: true,
  updatedBy: adminId,
  createdAt: now,
  updatedAt: now,
});
print(" pricingconfigs: " + db.pricingconfigs.countDocuments() + " documents");

// ============================================================
//  3. PAYMENT CONFIG
// ============================================================
db.paymentconfigs.drop();
db.paymentconfigs.insertOne({
  bankName: "VietinBank",
  bankBin: "970415",
  accountNumber: "101876543210",
  accountName: "CONG TY IPARK VIET NAM",
  transferPrefix: "IPARK",
  isActive: true,
  updatedBy: adminId,
  createdAt: now,
  updatedAt: now,
});
print(" paymentconfigs: " + db.paymentconfigs.countDocuments() + " documents");

// ============================================================
//  4. DEVICES
// ============================================================
db.devices.drop();
db.devices.insertMany([
  {
    name: "Camera Cổng Vào 1",
    gate: "entry",
    status: "online",
    rtspUrl: null,
    lastSnapshot: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Camera Cổng Ra 1",
    gate: "exit",
    status: "online",
    rtspUrl: null,
    lastSnapshot: null,
    createdAt: now,
    updatedAt: now,
  },
]);
print(" devices: " + db.devices.countDocuments() + " documents");

// ============================================================
//  5. MEMBERSHIP PACKAGES
// ============================================================
db.membershippackages.drop();
db.membershippackages.insertMany([
  {
    name: "Gói Ngày Cơ Bản",
    code: "DAY_BASIC",
    billingCycle: "Daily",
    price: 15000,
    durationDays: 1,
    status: "Active",
    features: ["Gửi xe 24h", "Không giới hạn lượt ra vào"],
    createdBy: adminId,
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Gói Tháng Tiêu Chuẩn",
    code: "MONTH_STANDARD",
    billingCycle: "Monthly",
    price: 300000,
    durationDays: 30,
    status: "Active",
    features: ["Gửi xe 30 ngày", "Không giới hạn lượt ra vào", "Hỗ trợ 24/7"],
    createdBy: adminId,
    createdAt: now,
    updatedAt: now,
  },
  {
    name: "Gói Năm VIP",
    code: "YEAR_VIP",
    billingCycle: "Yearly",
    price: 2500000,
    durationDays: 365,
    status: "Active",
    features: [
      "Gửi xe 365 ngày",
      "Ưu tiên chỗ đỗ",
      "Hỗ trợ 24/7",
      "Giảm 10% phí phát sinh",
    ],
    createdBy: adminId,
    createdAt: now,
    updatedAt: now,
  },
]);
print(
  " membershippackages: " +
    db.membershippackages.countDocuments() +
    " documents",
);

// ============================================================
//  6. ZONES (Khu vực đỗ xe)
// ============================================================
db.zones.drop();

const zoneAId = new ObjectId();
const zoneBId = new ObjectId();
const zoneCId = new ObjectId();

db.zones.insertMany([
  {
    _id: zoneAId,
    name: "Khu A",
    description: "Khu đỗ xe tầng trệt cổng chính",
    capacity: 10,
    allowedVehicleTypes: ["Ô tô"],
    displayOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: zoneBId,
    name: "Khu B",
    description: "Khu đỗ xe tầng trệt cổng phụ",
    capacity: 10,
    allowedVehicleTypes: ["Ô tô"],
    displayOrder: 2,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: zoneCId,
    name: "Khu C",
    description: "Khu đỗ xe VIP tầng hầm B1",
    capacity: 10,
    allowedVehicleTypes: ["Ô tô"],
    displayOrder: 3,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
]);
print(" zones: " + db.zones.countDocuments() + " documents");

// ============================================================
//  7. VEHICLES
// ============================================================
db.vehicles.drop();

const vehicle1Id = new ObjectId();

db.vehicles.insertMany([
  {
    _id: vehicle1Id,
    plate: "30H-123.45",
    vehicleType: "Ô tô",
    color: "Trắng",
    brand: "Toyota",
    userId: custId,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    plate: "51G-888.88",
    vehicleType: "Ô tô",
    color: "Đen",
    brand: "Honda",
    userId: custId,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  },
]);
print(" vehicles: " + db.vehicles.countDocuments() + " documents");

// ============================================================
//  8. PARKING SESSIONS
// ============================================================
db.parkingsessions.drop();

const session1Id = new ObjectId();
const checkIn1 = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 giờ trước
const checkOut1 = new Date(now.getTime() - 30 * 60 * 1000); // 30 phút trước

const session2Id = new ObjectId();
const checkIn2 = new Date(now.getTime() - 45 * 60 * 1000); // 45 phút trước

db.parkingsessions.insertMany([
  {
    _id: session1Id,
    plate: "30H-123.45",
    vehicleType: "Ô tô",
    zone: "Khu A",
    slotCode: "A-01",
    checkInAt: checkIn1,
    checkOutAt: checkOut1,
    status: "Đã hoàn thành",
    fee: 10000,
    userId: custId,
    checkInBy: staff1Id,
    checkOutBy: staff1Id,
    checkInImage: null,
    checkOutImage: null,
    createdAt: checkIn1,
    updatedAt: checkOut1,
  },
  {
    _id: session2Id,
    plate: "51G-888.88",
    vehicleType: "Ô tô",
    zone: "Khu B",
    slotCode: "B-03",
    checkInAt: checkIn2,
    checkOutAt: null,
    status: "Đang gửi",
    fee: 0,
    userId: custId,
    checkInBy: staff2Id,
    checkOutBy: null,
    checkInImage: null,
    checkOutImage: null,
    createdAt: checkIn2,
    updatedAt: checkIn2,
  },
]);
print(
  " parkingsessions: " + db.parkingsessions.countDocuments() + " documents",
);

// ============================================================
//  9. TRANSACTIONS
// ============================================================
db.transactions.drop();
db.transactions.insertMany([
  {
    userId: custId,
    type: "topup",
    amount: 500000,
    description: "Nạp tiền ví lần đầu",
    status: "completed",
    sessionId: null,
    createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    userId: custId,
    type: "payment",
    amount: 10000,
    description: "Thanh toán phiên đỗ xe 30H-123.45",
    status: "completed",
    sessionId: session1Id,
    createdAt: checkOut1,
    updatedAt: checkOut1,
  },
]);
print(" transactions: " + db.transactions.countDocuments() + " documents");

// ============================================================
//  10. NOTIFICATIONS
// ============================================================
db.notifications.drop();
db.notifications.insertMany([
  {
    userId: custId,
    title: "Chào mừng đến iPARK!",
    message: "Tài khoản của bạn đã được tạo thành công.",
    type: "info",
    isRead: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: custId,
    title: "Xe đã vào bãi",
    message:
      "Xe 51G-888.88 đã vào Khu B lúc " + checkIn2.toLocaleTimeString("vi-VN"),
    type: "session",
    isRead: false,
    createdAt: checkIn2,
    updatedAt: checkIn2,
  },
]);
print(" notifications: " + db.notifications.countDocuments() + " documents");

// ============================================================
print("\n Seed hoàn tất! Database: " + DB_NAME);
print("   Tài khoản:");
print("   admin@ipark.vn     → mật khẩu: admin");
print("   nv.1@ipark.vn      → mật khẩu: 123456");
print("   nv.2@ipark.vn      → mật khẩu: 123456");
print("   kh.1@gmail.com     → mật khẩu: 123456");

import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "./models/User.js";
import { PricingConfig } from "./models/PricingConfig.js";
import { PaymentConfig } from "./models/PaymentConfig.js";
import { Device } from "./models/Device.js";
import { MembershipPackage } from "./models/MembershipPackage.js";
import { Zone } from "./models/Zone.js";
import { ParkingSession } from "./models/ParkingSession.js";
import { Transaction } from "./models/Transaction.js";
import { Vehicle } from "./models/Vehicle.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ipark";

async function seedDatabase() {
  try {
    console.log("Connecting to MongoDB at:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB successfully.");

    // 1. Seed Users
    console.log("Seeding Users...");
    await User.deleteMany({});
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash("admin", salt);
    const staffPasswordHash = await bcrypt.hash("123456", salt);

    const adminUser = await User.create({
      name: "Super Admin iPARK",
      email: "admin@ipark.vn",
      passwordHash: adminPasswordHash,
      role: "admin",
      status: "Đang hoạt động",
      wallet: 0,
      provider: "credentials",
      twoFactorEnabled: false,
    });

    const staff1 = await User.create({
      name: "Nhân viên cổng 1",
      email: "nv.1@ipark.vn",
      passwordHash: staffPasswordHash,
      role: "staff",
      status: "Đang hoạt động",
      wallet: 0,
      provider: "credentials",
      twoFactorEnabled: false,
    });

    const staff2 = await User.create({
      name: "Nhân viên cổng 2",
      email: "nv.2@ipark.vn",
      passwordHash: staffPasswordHash,
      role: "staff",
      status: "Đang hoạt động",
      wallet: 0,
      provider: "credentials",
      twoFactorEnabled: false,
    });

    console.log("Users seeded successfully.");

    // 2. Seed Pricing Config
    console.log("Seeding Pricing Config...");
    await PricingConfig.deleteMany({});
    await PricingConfig.create({
      freeMinutes: 20,
      hourlyRate: 10000,
      overnightRate: 50000,
      monthlyRate: 1500000,
      overdueFineRate: 20000,
      dailyMaxRate: 100000,
      graceExitMinutes: 10,
      isActive: true,
      updatedBy: adminUser._id,
    });
    console.log("Pricing Config seeded successfully.");

    // 3. Seed Payment Config
    console.log("Seeding Payment Config...");
    await PaymentConfig.deleteMany({});
    await PaymentConfig.create({
      bankName: "VietinBank",
      bankBin: "970415",
      accountNumber: "101876543210",
      accountName: "CONG TY IPARK VIET NAM",
      transferPrefix: "IPARK",
      isActive: true,
      updatedBy: adminUser._id,
    });
    console.log("Payment Config seeded successfully.");

    // 4. Seed Devices
    console.log("Seeding Devices...");
    await Device.deleteMany({});
    await Device.create([
      {
        name: "Camera Cổng Vào 1",
        gate: "entry",
        status: "online",
      },
      {
        name: "Camera Cổng Ra 1",
        gate: "exit",
        status: "online",
      },
    ]);
    console.log("Devices seeded successfully.");

    // 5. Seed Membership Packages
    console.log("Seeding Membership Packages...");
    await MembershipPackage.deleteMany({});
    await MembershipPackage.create([
      {
        name: "Gói Ngày Cơ Bản",
        code: "DAY_BASIC",
        billingCycle: "Daily",
        price: 15000,
        durationDays: 1,
        status: "Active",
        features: ["Gửi xe 24h", "Không giới hạn lượt ra vào"],
        createdBy: adminUser._id,
      },
      {
        name: "Gói Tháng Tiêu Chuẩn",
        code: "MONTH_STANDARD",
        billingCycle: "Monthly",
        price: 300000,
        durationDays: 30,
        status: "Active",
        features: [
          "Gửi xe 30 ngày",
          "Không giới hạn lượt ra vào",
          "Hỗ trợ 24/7",
        ],
        createdBy: adminUser._id,
      },
      {
        name: "Gói Tháng Cao Cấp",
        code: "MONTH_PREMIUM",
        billingCycle: "Monthly",
        price: 450000,
        durationDays: 30,
        status: "Active",
        features: [
          "Gửi xe 30 ngày",
          "Vị trí ưu tiên",
          "Hỗ trợ 24/7",
          "Rửa xe miễn phí 2 lần",
        ],
        createdBy: adminUser._id,
      },
    ]);
    console.log("Membership Packages seeded successfully.");

    // 6. Seed Zones
    console.log("Seeding Zones...");
    await Zone.deleteMany({});
    await Zone.create([
      {
        name: "A",
        description: "Khu A - Tầng 1, gần cổng vào",
        capacity: 10,
        allowedVehicleTypes: ["Ô tô"],
        displayOrder: 1,
        isActive: true,
      },
      {
        name: "B",
        description: "Khu B - Tầng 2, khu vực yên tĩnh",
        capacity: 10,
        allowedVehicleTypes: ["Ô tô"],
        displayOrder: 2,
        isActive: true,
      },
    ]);
    console.log("Zones seeded successfully.");

    // 7. Seed Registered Vehicles
    console.log("Seeding Vehicles...");
    await Vehicle.deleteMany({});
    await Vehicle.create([
      {
        plate: "30H-123.45",
        ownerName: "Nguyễn Văn A",
        vehicleType: "Ô tô",
        status: "Đã đăng ký",
        userId: adminUser._id,
      },
      {
        plate: "51G-888.88",
        ownerName: "Trần Thị B",
        vehicleType: "Ô tô",
        status: "Đã đăng ký",
        userId: staff1._id,
      },
      {
        plate: "29C-999.99",
        ownerName: "Lê Văn C",
        vehicleType: "Ô tô",
        status: "Đã đăng ký",
        userId: adminUser._id,
      },
      {
        plate: "43A-111.22",
        ownerName: "Phạm Thị D",
        vehicleType: "Ô tô",
        status: "Đã đăng ký",
      },
      {
        plate: "16B-333.44",
        ownerName: "Hoàng Văn E",
        vehicleType: "Ô tô",
        status: "Đã đăng ký",
      },
      {
        plate: "75D-555.66",
        ownerName: "Vũ Thị F",
        vehicleType: "Ô tô",
        status: "Cần duyệt",
      },
    ]);
    console.log("Vehicles seeded successfully.");

    // 8. Seed Parking Sessions
    console.log("Seeding Parking Sessions...");
    await ParkingSession.deleteMany({});
    const now = new Date();

    const session1 = await ParkingSession.create({
      plate: "30H-123.45",
      ownerName: "Nguyễn Văn A",
      vehicleType: "Ô tô",
      slot: "A-01",
      checkInAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      checkOutAt: new Date(now.getTime() - 30 * 60 * 1000),
      status: "Đã hoàn thành",
      paymentStatus: "paid",
      fee: 30000,
      entryConfidence: 0.97,
      exitConfidence: 0.95,
      matchStatus: "Khớp",
      verificationStatus: "Không cần",
      ownerUserId: adminUser._id,
      createdBy: adminUser._id,
    });

    const session2 = await ParkingSession.create({
      plate: "43A-111.22",
      ownerName: "Phạm Thị D",
      vehicleType: "Ô tô",
      slot: "A-02",
      checkInAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      checkOutAt: new Date(now.getTime() - 90 * 60 * 1000),
      status: "Đã hoàn thành",
      paymentStatus: "paid",
      fee: 50000,
      entryConfidence: 0.99,
      exitConfidence: 0.98,
      matchStatus: "Khớp",
      verificationStatus: "Không cần",
      createdBy: staff1._id,
    });

    const session3 = await ParkingSession.create({
      plate: "16B-333.44",
      ownerName: "Hoàng Văn E",
      vehicleType: "Ô tô",
      slot: "B-01",
      checkInAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      checkOutAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      status: "Đã hoàn thành",
      paymentStatus: "paid",
      fee: 80000,
      entryConfidence: 0.93,
      exitConfidence: 0.94,
      matchStatus: "Khớp",
      verificationStatus: "Không cần",
      createdBy: staff2._id,
    });

    const session4 = await ParkingSession.create({
      plate: "51G-888.88",
      ownerName: "Trần Thị B",
      vehicleType: "Ô tô",
      slot: "B-02",
      checkInAt: new Date(now.getTime() - 45 * 60 * 1000),
      status: "Đang gửi",
      paymentStatus: "unpaid",
      fee: 0,
      entryConfidence: 0.96,
      matchStatus: "Chưa checkout",
      verificationStatus: "Không cần",
      ownerUserId: staff1._id,
      createdBy: staff1._id,
    });

    const session5 = await ParkingSession.create({
      plate: "29C-999.99",
      ownerName: "Lê Văn C",
      vehicleType: "Ô tô",
      slot: "B-03",
      checkInAt: new Date(now.getTime() - 10 * 60 * 1000),
      status: "Đang gửi",
      paymentStatus: "unpaid",
      fee: 0,
      entryConfidence: 0.98,
      matchStatus: "Chưa checkout",
      verificationStatus: "Không cần",
      ownerUserId: adminUser._id,
      createdBy: staff2._id,
    });

    const session6 = await ParkingSession.create({
      plate: "75D-555.66",
      ownerName: "Vũ Thị F",
      vehicleType: "Ô tô",
      slot: "A-03",
      checkInAt: new Date(now.getTime() - 25 * 60 * 1000),
      status: "Đang gửi",
      paymentStatus: "unpaid",
      fee: 0,
      entryConfidence: 0.91,
      matchStatus: "Chưa checkout",
      verificationStatus: "Không cần",
      createdBy: staff1._id,
    });

    console.log("Parking Sessions seeded successfully.");

    // 9. Seed Transactions
    console.log("Seeding Transactions...");
    await Transaction.deleteMany({});
    await Transaction.create([
      {
        sessionId: session1._id,
        userId: adminUser._id,
        method: "vietqr",
        amount: 30000,
        status: "paid",
        content: "IPARK-3012345",
        paidAt: new Date(now.getTime() - 30 * 60 * 1000),
        confirmedBy: staff1._id,
      },
      {
        sessionId: session2._id,
        userId: adminUser._id,
        method: "cash",
        amount: 50000,
        status: "paid",
        content: "IPARK-4311122",
        paidAt: new Date(now.getTime() - 90 * 60 * 1000),
        confirmedBy: staff1._id,
      },
      {
        sessionId: session3._id,
        userId: adminUser._id,
        method: "wallet",
        amount: 80000,
        status: "paid",
        content: "IPARK-1633344",
        paidAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        confirmedBy: staff2._id,
      },
    ]);
    console.log("Transactions seeded successfully.");

    // Summary
    console.log("\n========================================");
    console.log("  iPARK - Database Seed Summary");
    console.log("========================================");
    console.log(`  Admin login : admin@ipark.vn / admin`);
    console.log(`  Staff login : nv.1@ipark.vn  / 123456`);
    console.log(`  Staff login : nv.2@ipark.vn  / 123456`);
    console.log("----------------------------------------");
    console.log(`  Zones       : Khu A (10), Khu B (10) = 20 slots`);
    console.log(`  Vehicles    : 6 xe đã đăng ký`);
    console.log(`  Active      : 3 xe đang gửi`);
    console.log(`  Completed   : 3 phiên đã hoàn thành`);
    console.log(`  Revenue     : 160.000 VNĐ`);
    console.log("========================================\n");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

seedDatabase();

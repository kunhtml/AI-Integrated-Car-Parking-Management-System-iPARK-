// ============================================================
// MONGODB CLEAN SCHEMA SCRIPT - BAI DO XE v5
// ============================================================
// Database: bai_do_xe
// Mô tả:     Đã clean - bỏ field/models unused, sửa logic, gộp duplicate
// Chạy:      mongosh "mongodb://localhost:27017/bai_do_xe" < clean_schema.js
// Hoặc:      mongosh "mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/bai_do_xe" < clean_schema.js
// ============================================================

// ------------------------------------------------------------
// 0. DROP TOÀN BỘ COLLECTIONS CŨ (CHẠY 1 LẦN ĐẦU)
// ------------------------------------------------------------
// ⚠️  NẾU MUỐN GIỮ DATA, hãy BACKUP trước khi chạy!
//
// db.dropDatabase();  // Drop toàn bộ DB (CHỈ chạy 1 lần khi re-init)

const DROP_AND_RECREATE = false; // Đặt true nếu muốn xóa hết DB cũ
if (DROP_AND_RECREATE) {
  print("⚠️  Dropping all collections...");
  db.getCollectionNames().forEach((c) => db[c].drop());
  print("✅ All collections dropped");
}

// ============================================================
// 1. USER
// ============================================================
// Bỏ: firstName, lastName, birthDate, gender, idCardNumber, idCardIssuedAt,
//      idCardExpiry, address, city, district, emergencyContact, emergencyPhone,
//      company, taxCode, verificationToken, resetPasswordToken,
//      failedLoginCount, lockedUntil, lastLoginIp
// Lý do: Không có reference trong controller/service (verify OTP dùng OtpToken)
//        Xác thực: grep trong controllers/ → 0 reference
// ============================================================
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "passwordHash", "role", "status", "provider", "isVerified"],
      properties: {
        name:           { bsonType: "string", minLength: 1 },
        email:          { bsonType: "string", pattern: "^\\S+@\\S+\\.\\S+$" },
        passwordHash:   { bsonType: "string" },
        role:           { enum: ["admin", "staff", "customer"] },
        status:         { enum: ["Đang hoạt động", "Đã khóa"] },
        phone:          { bsonType: ["string", "null"] },
        avatarUrl:      { bsonType: ["string", "null"] },
        provider:       { enum: ["credentials", "google", "mixed"] },
        googleId:       { bsonType: ["string", "null"] },
        twoFactorEnabled: { bsonType: "bool" },
        twoFactorSecret:  { bsonType: ["string", "null"] },
        twoFactorPendingSecret: { bsonType: ["string", "null"] },
        lastLoginAt:    { bsonType: ["date", "null"] },
        isVerified:     { bsonType: "bool" },
      },
    },
  },
});
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ googleId: 1 }, { sparse: true });
db.users.createIndex({ role: 1, status: 1 });

// ============================================================
// 2. ACTIVE SESSION
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("activesessions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "loginAt", "lastActiveAt", "expiresAt", "isRevoked"],
      properties: {
        userId:       { bsonType: "objectId" },
        userAgent:    { bsonType: ["string", "null"] },
        ipAddress:    { bsonType: ["string", "null"] },
        loginAt:      { bsonType: "date" },
        lastActiveAt: { bsonType: "date" },
        expiresAt:    { bsonType: "date" },
        isRevoked:    { bsonType: "bool" },
      },
    },
  },
});
db.activesessions.createIndex({ userId: 1 });
db.activesessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ============================================================
// 3. OTP TOKEN
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("otptokens", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "otpHash", "purpose", "expiresAt"],
      properties: {
        email:     { bsonType: "string" },
        otpHash:   { bsonType: "string" },
        purpose:   { enum: ["reset-password"] },
        expiresAt: { bsonType: "date" },
        usedAt:    { bsonType: ["date", "null"] },
      },
    },
  },
});
db.otptokens.createIndex({ email: 1 });
db.otptokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ============================================================
// 4. VEHICLE
// ============================================================
// Bỏ: notes, imageUrl, ownerIdCard
// Lý do: 0 reference ngoài model file
// ============================================================
db.createCollection("vehicles", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["plate", "ownerName", "vehicleType", "status", "isCompanyVehicle"],
      properties: {
        plate:        { bsonType: "string" },
        ownerName:    { bsonType: "string" },
        vehicleType:  { enum: ["Ô tô"] },
        status:       { enum: ["Đã đăng ký", "Cần duyệt", "Blacklist"] },
        userId:       { bsonType: ["objectId", "null"] },
        brand:        { bsonType: ["string", "null"] },
        model:        { bsonType: ["string", "null"] },
        color:        { bsonType: ["string", "null"] },
        year:         { bsonType: ["int", "null"] },
        engineNo:     { bsonType: ["string", "null"] },
        chassisNo:    { bsonType: ["string", "null"] },
        ownerPhone:   { bsonType: ["string", "null"] },
        ownerAddress: { bsonType: ["string", "null"] },
        ownerEmail:   { bsonType: ["string", "null"] },
        isCompanyVehicle: { bsonType: "bool" },
      },
    },
  },
});
db.vehicles.createIndex({ plate: 1 }, { unique: true });
db.vehicles.createIndex({ userId: 1 });
db.vehicles.createIndex({ status: 1 });

// ============================================================
// 5. VEHICLE REQUEST
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("vehiclerequests", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["vehicleId", "subscriptionId", "userId", "type", "status"],
      properties: {
        vehicleId:        { bsonType: "objectId" },
        subscriptionId:   { bsonType: "objectId" },
        userId:           { bsonType: "objectId" },
        type:             { enum: ["edit", "delete"] },
        status:           { enum: ["pending", "approved", "rejected"] },
        requestedChanges: { bsonType: ["object", "null"] },
        reason:           { bsonType: ["string", "null"] },
        adminNote:        { bsonType: ["string", "null"] },
        resolvedBy:       { bsonType: ["objectId", "null"] },
        resolvedAt:       { bsonType: ["date", "null"] },
      },
    },
  },
});
db.vehiclerequests.createIndex({ userId: 1, status: 1 });
db.vehiclerequests.createIndex({ subscriptionId: 1, vehicleId: 1, type: 1, status: 1 });

// ============================================================
// 6. ZONE
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("zones", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "capacity", "allowedVehicleTypes", "displayOrder", "isActive"],
      properties: {
        name:               { bsonType: "string" },
        description:        { bsonType: ["string", "null"] },
        capacity:           { bsonType: "int", minimum: 1 },
        allowedVehicleTypes:{ bsonType: "array", items: { bsonType: "string" } },
        pricingConfigId:    { bsonType: ["objectId", "null"] },
        displayOrder:       { bsonType: "int" },
        isActive:           { bsonType: "bool" },
        cameraId:           { bsonType: ["objectId", "null"] },
        // Polygon cho AI detection
        laneDividers:       { bsonType: ["array", "null"] },
        slotPolygons:       { bsonType: ["array", "null"] },
      },
    },
  },
});
db.zones.createIndex({ name: 1 }, { unique: true });
db.zones.createIndex({ isActive: 1 });

// ============================================================
// 7. PARKING SLOT
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("parkingslots", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["slotCode", "zoneId", "zoneName", "slotType", "status", "floor", "isActive"],
      properties: {
        slotCode:         { bsonType: "string" },
        zoneId:           { bsonType: "objectId" },
        zoneName:         { bsonType: "string" },
        slotType:         { enum: ["regular", "VIP", "electric", "handicap"] },
        features:         { bsonType: "array", items: { bsonType: "string" } },
        status:           { enum: ["empty", "occupied", "reserved", "maintenance"] },
        currentSessionId: { bsonType: ["objectId", "null"] },
        floor:            { bsonType: "int" },
        notes:            { bsonType: ["string", "null"] },
        dimensions:       { bsonType: ["string", "null"] },
        maxVehicleSize:   { bsonType: ["string", "null"] },
        cameraId:         { bsonType: ["objectId", "null"] },
        aiPolygon:        { bsonType: ["array", "null"] },
        lastMaintenance:  { bsonType: ["date", "null"] },
        isActive:         { bsonType: "bool" },
      },
    },
  },
});
db.parkingslots.createIndex({ slotCode: 1 }, { unique: true });
db.parkingslots.createIndex({ zoneId: 1, status: 1 });
db.parkingslots.createIndex({ status: 1, slotType: 1 });

// ============================================================
// 8. PARKING SESSION (CORE - nhiều thay đổi)
// ============================================================
// GIỮ:    core fields (plate, ownerName, checkInAt, slot, status, paymentStatus, fee)
// BỎ:     dailyBreakdown (duplicate với feeBreakdown.dailyBreakdown)
// ĐỔI:    paymentStatus có enum validator
// ============================================================
db.createCollection("parkingsessions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "plate", "ownerName", "vehicleType", "checkInAt", "slot",
        "status", "paymentStatus", "fee", "paidAmount",
        "isOverstayed", "overdueMinutes", "discountAmount",
      ],
      properties: {
        // --- Thông tin xe ---
        plate:        { bsonType: "string" },
        ownerName:    { bsonType: "string" },
        vehicleType:  { enum: ["Ô tô"] },

        // --- Thời gian ---
        checkInAt:           { bsonType: "date" },
        checkOutAt:          { bsonType: ["date", "null"] },
        expectedCheckOutAt:  { bsonType: ["date", "null"] },

        // --- Vị trí ---
        slot:    { bsonType: "string" },
        slotId:  { bsonType: ["objectId", "null"] },
        zone:    { bsonType: ["string", "null"] },
        floor:   { bsonType: ["int", "null"] },
        slotType:{ bsonType: ["string", "null"] },

        // --- Trạng thái ---
        status:        { enum: ["Đang gửi", "Đã hoàn thành", "Đã hủy"] },
        paymentStatus: { enum: ["unpaid", "partial_paid", "fully_paid"] },
        paymentMethod: { bsonType: ["string", "null"] }, // payos, cash, subscription
        isOverstayed:  { bsonType: "bool" },
        overdueMinutes:{ bsonType: "int" },

        // --- Phí ---
        fee:            { bsonType: "number", minimum: 0 },
        paidAmount:     { bsonType: "number", minimum: 0 },
        discountAmount: { bsonType: "number", minimum: 0 },
        discountReason: { bsonType: ["string", "null"] },

        // --- Phí chi tiết (đã có dailyBreakdown inside) ---
        feeBreakdown: {
          bsonType: ["object", "null"],
          properties: {
            totalMinutes:    { bsonType: "int" },
            freeMinutes:     { bsonType: "int" },
            billableMinutes: { bsonType: "int" },
            billableHours:   { bsonType: "number" },
            hourlyRate:      { bsonType: "number" },
            parkingFee:      { bsonType: "number" },
            overdueFine:     { bsonType: "number" },
            totalFee:        { bsonType: "number" },
            dailyBreakdown:  { bsonType: "array" },
            subscriptionDiscount: { bsonType: ["number", "null"] },
            subscriptionWarn: { bsonType: ["string", "null"] },
          },
        },

        // --- Nhận dạng biển số ---
        ownerUserId:        { bsonType: ["objectId", "null"] },
        vehicleId:          { bsonType: ["objectId", "null"] },
        entryImageUrl:      { bsonType: ["string", "null"] },
        exitImageUrl:       { bsonType: ["string", "null"] },
        entryDetectedPlate: { bsonType: ["string", "null"] },
        exitDetectedPlate:  { bsonType: ["string", "null"] },
        entryConfidence:    { bsonType: ["number", "null"] },
        exitConfidence:     { bsonType: ["number", "null"] },
        vehicleMatchScore:  { bsonType: ["number", "null"] },
        matchStatus:        { enum: ["Chưa checkout", "Khớp", "Không khớp"] },

        // --- Xác minh thủ công ---
        verificationStatus: { enum: ["Không cần", "Chờ duyệt", "Đã duyệt", "Từ chối"] },
        manualPlate:        { bsonType: ["string", "null"] },
        verificationNote:   { bsonType: ["string", "null"] },
        verifiedBy:         { bsonType: ["objectId", "null"] },
        verifiedAt:         { bsonType: ["date", "null"] },

        // --- Liên kết ---
        transactionId:  { bsonType: ["objectId", "null"] },
        createdBy:      { bsonType: ["objectId", "null"] },
        checkInStaff:   { bsonType: ["objectId", "null"] },
        checkOutStaff:  { bsonType: ["objectId", "null"] },
        entryGate:      { bsonType: ["string", "null"] },
        exitGate:       { bsonType: ["string", "null"] },

        // --- Trả trước (prepaid) ---
        ownerEmail:             { bsonType: ["string", "null"] },
        prepaidCheckoutAt:      { bsonType: ["date", "null"] },
        lastReminderAt:         { bsonType: ["date", "null"] },
        lastPrepaidReminderAt:  { bsonType: ["date", "null"] },

        // --- Hủy ---
        cancellationReason: { bsonType: ["string", "null"] },
        cancelledBy:        { bsonType: ["objectId", "null"] },
        cancelledAt:        { bsonType: ["date", "null"] },

        // --- Khác ---
        notes: { bsonType: ["string", "null"] },
      },
    },
  },
});
db.parkingsessions.createIndex({ plate: 1, checkInAt: -1 });
db.parkingsessions.createIndex({ status: 1 });
db.parkingsessions.createIndex({ paymentStatus: 1 });
db.parkingsessions.createIndex({ verificationStatus: 1 });
db.parkingsessions.createIndex({ ownerUserId: 1 });
db.parkingsessions.createIndex({ slotId: 1 });
db.parkingsessions.createIndex({ checkInAt: -1 });
db.parkingsessions.createIndex({ checkOutAt: 1 }, { sparse: true });

// ============================================================
// 9. RESERVATION
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("reservations", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "slotId", "slotCode", "zoneName", "vehicleType", "plate", "reservedFrom", "reservedUntil", "status", "depositAmount"],
      properties: {
        userId:         { bsonType: "objectId" },
        slotId:         { bsonType: "objectId" },
        slotCode:       { bsonType: "string" },
        zoneName:       { bsonType: "string" },
        vehicleType:    { bsonType: "string" },
        plate:          { bsonType: "string" },
        reservedFrom:   { bsonType: "date" },
        reservedUntil:  { bsonType: "date" },
        status:         { enum: ["pending", "active", "completed", "cancelled", "expired"] },
        sessionId:      { bsonType: ["objectId", "null"] },
        depositAmount:  { bsonType: "number", minimum: 0 },
        cancelledAt:    { bsonType: ["date", "null"] },
        cancelReason:   { bsonType: ["string", "null"] },
      },
    },
  },
});
db.reservations.createIndex({ userId: 1, status: 1 });
db.reservations.createIndex({ slotId: 1, status: 1 });
db.reservations.createIndex({ reservedUntil: 1, status: 1 });

// ============================================================
// 10. SUBSCRIPTION PLAN
// ============================================================
// ĐỔI: maxVehicles - bỏ giá trị -1 (hack), dùng field maxVehicles nullable
//        null = không giới hạn, 0 = không cho phép, >=1 = giới hạn
// ============================================================
db.createCollection("subscriptionplans", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "duration", "durationDays", "price", "isActive"],
      properties: {
        name:         { bsonType: "string" },
        description:  { bsonType: ["string", "null"] },
        duration:     { enum: ["monthly", "quarterly", "yearly"] },
        durationDays: { bsonType: "int", minimum: 1 },
        price:        { bsonType: "number", minimum: 0 },
        maxVehicles:  { bsonType: ["int", "null"], minimum: 0 },
        isActive:     { bsonType: "bool" },
      },
    },
  },
});
db.subscriptionplans.createIndex({ isActive: 1 });

// ============================================================
// 11. SUBSCRIPTION
// ============================================================
// Mỗi gói gắn với DUY NHẤT 1 xe (primaryVehicleId, unique sparse).
// Mỗi gói có 1 memberCode riêng (unique sparse).
// 1 user có thể có nhiều gói (mỗi xe 1 gói).
// ============================================================
db.createCollection("subscriptions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "planId", "planName", "primaryVehicleId", "startDate", "endDate", "status", "autoRenew", "renewalCount"],
      properties: {
        userId:            { bsonType: "objectId" },
        planId:            { bsonType: "objectId" },
        planName:          { bsonType: "string" },
        primaryVehicleId:  { bsonType: "objectId" },
        memberCode:        { bsonType: ["string", "null"] },
        startDate:         { bsonType: "date" },
        endDate:           { bsonType: "date" },
        status:            { enum: ["pending_payment", "active", "expired", "cancelled"] },
        autoRenew:         { bsonType: "bool" },
        transactionId:     { bsonType: ["objectId", "null"] },
        renewalCount:      { bsonType: "int", minimum: 0 },
      },
    },
  },
});
db.subscriptions.createIndex({ userId: 1, status: 1 });
db.subscriptions.createIndex({ endDate: 1, status: 1 });
db.subscriptions.createIndex({ primaryVehicleId: 1 }, { unique: true, sparse: true });
db.subscriptions.createIndex({ memberCode: 1 }, { unique: true, sparse: true });

// ============================================================
// 12. TRANSACTION (CLEAN - bỏ ~18 field UNUSED)
// ============================================================
// BỎ:  transactionCode, bankTransactionId, bankName, accountNumber, accountName,
//      gateway, couponCode, exchangeRate, fee, tax, paymentGatewayResponse,
//      invoiceNumber, refundAmount, refundReason, refundedAt, refundedBy,
//      receiptUrl, currency, previousFee, newFee, extensionId, extensionType,
//      qrUrl, description, confirmedBy
// GIỮ: sessionId, userId, method, amount, status, paidAt, note, subscriptionId,
//      payosOrderCode, payosPaymentLinkId, payosCheckoutUrl, payosQrCode
// ============================================================
db.createCollection("transactions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["method", "amount", "status"],
      properties: {
        sessionId:      { bsonType: ["objectId", "null"] },
        userId:         { bsonType: ["objectId", "null"] },
        subscriptionId: { bsonType: ["objectId", "null"] },
        method:         { enum: ["payos", "cash"] },
        amount:         { bsonType: "number", minimum: 0 },
        status:         { enum: ["pending", "paid", "failed", "cancelled"] },
        paidAt:         { bsonType: ["date", "null"] },
        note:           { bsonType: ["string", "null"] },
        // PayOS specific (essentials)
        payosOrderCode:      { bsonType: ["string", "null"] },
        payosPaymentLinkId:  { bsonType: ["string", "null"] },
        payosCheckoutUrl:    { bsonType: ["string", "null"] },
        payosQrCode:         { bsonType: ["string", "null"] },
      },
    },
  },
});
db.transactions.createIndex({ sessionId: 1 });
db.transactions.createIndex({ userId: 1 });
db.transactions.createIndex({ subscriptionId: 1 });
db.transactions.createIndex({ payosOrderCode: 1 }, { unique: true, sparse: true });
db.transactions.createIndex({ status: 1, createdAt: -1 });

// ============================================================
// 13. PENALTY CONFIG
// ============================================================
// BỎ: enum violationType (chỉ 1 giá trị) - dùng String thường
// ============================================================
db.createCollection("penaltyconfigs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["violationType", "label", "amount", "isActive"],
      properties: {
        violationType: { bsonType: "string" },
        label:         { bsonType: "string" },
        amount:        { bsonType: "number", minimum: 0 },
        description:   { bsonType: ["string", "null"] },
        isActive:      { bsonType: "bool" },
        updatedBy:     { bsonType: ["objectId", "null"] },
      },
    },
  },
});
db.penaltyconfigs.createIndex({ violationType: 1 }, { unique: true });
db.penaltyconfigs.createIndex({ isActive: 1 });

// ============================================================
// 14. PENALTY
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("penalties", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["plate", "violationType", "amount", "slotCode", "status"],
      properties: {
        plate:             { bsonType: "string" },
        violationType:     { bsonType: "string" },
        amount:            { bsonType: "number", minimum: 0 },
        slotId:            { bsonType: ["objectId", "null"] },
        slotCode:          { bsonType: "string" },
        zoneId:            { bsonType: ["objectId", "null"] },
        zoneName:          { bsonType: ["string", "null"] },
        sessionId:         { bsonType: ["objectId", "null"] },
        evidenceImageUrl:  { bsonType: ["string", "null"] },
        aiConfidence:      { bsonType: ["number", "null"] },
        note:              { bsonType: ["string", "null"] },
        status:            { enum: ["pending", "paid", "waived", "disputed"] },
        issuedBy:          { bsonType: ["objectId", "null"] },
        resolvedBy:        { bsonType: ["objectId", "null"] },
        resolvedAt:        { bsonType: ["date", "null"] },
      },
    },
  },
});
db.penalties.createIndex({ plate: 1 });
db.penalties.createIndex({ slotId: 1 });
db.penalties.createIndex({ zoneId: 1 });
db.penalties.createIndex({ status: 1, createdAt: -1 });

// ============================================================
// 15. PRICING CONFIG
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("pricingconfigs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["dayRate", "nightRate", "dayStartHour", "nightStartHour", "isActive"],
      properties: {
        dayRate:        { bsonType: "number", minimum: 0 },
        nightRate:      { bsonType: "number", minimum: 0 },
        dayStartHour:   { bsonType: "int", minimum: 0, maximum: 23 },
        nightStartHour: { bsonType: "int", minimum: 0, maximum: 23 },
        gracePeriod:    { bsonType: "int", minimum: 0 },
        maxMinutes:     { bsonType: "int", minimum: 0 },
        isActive:       { bsonType: "bool" },
        updatedBy:      { bsonType: ["objectId", "null"] },
      },
    },
  },
});
db.pricingconfigs.createIndex({ isActive: 1 });

// ============================================================
// 16. PAYMENT CONFIG (CLEAN - bỏ payosChecksumKey)
// ============================================================
// BỎ: payosChecksumKey (code dùng env var, không đọc từ DB)
// ============================================================
db.createCollection("paymentconfigs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["isActive"],
      properties: {
        isActive:         { bsonType: "bool" },
        payosEnabled:     { bsonType: "bool" },
        payosClientId:    { bsonType: ["string", "null"] },
        payosApiKey:      { bsonType: ["string", "null"] },
        payosWebhookUrl:  { bsonType: ["string", "null"] },
        updatedBy:        { bsonType: ["objectId", "null"] },
      },
    },
  },
});
db.paymentconfigs.createIndex({ isActive: 1 });

// ============================================================
// 17. DEVICE
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("devices", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "gate", "rtspUrl", "status", "healthCheckEnabled", "offlineThresholdMinutes"],
      properties: {
        name:        { bsonType: "string" },
        gate:        { enum: ["entry", "exit"] },
        rtspUrl:     { bsonType: "string" },
        username:    { bsonType: ["string", "null"] },
        password:    { bsonType: ["string", "null"] },
        roiNote:     { bsonType: ["string", "null"] },
        status:      { enum: ["online", "offline", "unknown"] },
        lastSnapshotUrl: { bsonType: ["string", "null"] },
        lastSnapshotAt:  { bsonType: ["date", "null"] },
        maintenanceSchedule: {
          bsonType: ["object", "null"],
          properties: {
            intervalDays:      { bsonType: "int" },
            lastMaintenanceAt: { bsonType: ["date", "null"] },
            nextMaintenanceAt: { bsonType: ["date", "null"] },
          },
        },
        laneDividers: { bsonType: ["array", "null"] },
        healthCheckEnabled:    { bsonType: "bool" },
        offlineThresholdMinutes: { bsonType: "int" },
        createdBy:    { bsonType: ["objectId", "null"] },
      },
    },
  },
});
db.devices.createIndex({ gate: 1 });
db.devices.createIndex({ status: 1 });

// ============================================================
// 18. DEVICE MAINTENANCE LOG
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("devicemaintenancelogs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["deviceId", "deviceName", "type", "description", "performedAt", "status"],
      properties: {
        deviceId:     { bsonType: "objectId" },
        deviceName:   { bsonType: "string" },
        type:         { enum: ["scheduled", "repair", "inspection", "replacement"] },
        description:  { bsonType: "string" },
        performedBy:  { bsonType: ["objectId", "null"] },
        performedAt:  { bsonType: "date" },
        cost:         { bsonType: "number", minimum: 0 },
        notes:        { bsonType: ["string", "null"] },
        status:       { enum: ["planned", "in_progress", "completed"] },
      },
    },
  },
});
db.devicemaintenancelogs.createIndex({ deviceId: 1 });
db.devicemaintenancelogs.createIndex({ status: 1, performedAt: -1 });

// ============================================================
// 19. INCIDENT (CLEAN - bỏ 14 field EXTENDED không dùng)
// ============================================================
// BỎ: severity, priority, description, attachments, relatedVehicleId,
//      relatedUserId, assignedTo, escalatedTo, resolution, resolutionTime,
//      affectedZone, cameraSnapshot, isRecurring, tags
// Lý do: 0 reference ngoài model file (grep controllers/services)
// ============================================================
db.createCollection("incidents", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["type", "note", "status", "isRecurring"],
      properties: {
        type:         { enum: ["Xe blacklist", "Lỗi nhận dạng", "Yêu cầu miễn phạt", "Camera offline", "Khác"] },
        note:         { bsonType: "string" },
        plate:        { bsonType: ["string", "null"] },
        sessionId:    { bsonType: ["objectId", "null"] },
        status:       { enum: ["Mới", "Đang xử lý", "Đã xử lý"] },
        createdBy:    { bsonType: ["objectId", "null"] },
        handledBy:    { bsonType: ["objectId", "null"] },
        handledAt:    { bsonType: ["date", "null"] },
        isRecurring:  { bsonType: "bool" },
      },
    },
  },
});
db.incidents.createIndex({ status: 1, createdAt: -1 });
db.incidents.createIndex({ plate: 1 }, { sparse: true });
db.incidents.createIndex({ sessionId: 1 }, { sparse: true });

// ============================================================
// 20. NOTIFICATION
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("notifications", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "content", "targetRole", "readBy"],
      properties: {
        title:      { bsonType: "string" },
        content:    { bsonType: "string" },
        targetRole: { enum: ["admin", "staff", "customer", "all"] },
        userId:     { bsonType: ["objectId", "null"] },
        readBy:     { bsonType: "array", items: { bsonType: "objectId" } },
      },
    },
  },
});
db.notifications.createIndex({ targetRole: 1 });
db.notifications.createIndex({ userId: 1 });
db.notifications.createIndex({ createdAt: -1 });

// ============================================================
// 21. NOTIFICATION TEMPLATE
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("notificationtemplates", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "triggerType", "title", "content", "isActive"],
      properties: {
        name:        { bsonType: "string" },
        triggerType: {
          enum: [
            "entry", "exit", "overdue", "low_balance", "promotion",
            "reservation_confirmed", "reservation_expired",
            "subscription_expiring", "custom",
          ],
        },
        title:     { bsonType: "string" },
        content:   { bsonType: "string" },
        isActive:  { bsonType: "bool" },
        createdBy: { bsonType: ["objectId", "null"] },
      },
    },
  },
});
db.notificationtemplates.createIndex({ name: 1 }, { unique: true });
db.notificationtemplates.createIndex({ triggerType: 1 });
db.notificationtemplates.createIndex({ isActive: 1 });

// ============================================================
// 22. SHIFT SCHEDULE
// ============================================================
// Giữ nguyên - đã clean
// ============================================================
db.createCollection("shiftschedules", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["staffId", "date", "shiftType", "startTime", "endTime", "status"],
      properties: {
        staffId:    { bsonType: "objectId" },
        date:       { bsonType: "date" },
        shiftType:  { enum: ["morning", "afternoon", "evening", "night"] },
        startTime:  { bsonType: "string" },
        endTime:    { bsonType: "string" },
        status:     { enum: ["scheduled", "checked_in", "completed", "cancelled"] },
        assignedBy: { bsonType: ["objectId", "null"] },
        note:       { bsonType: ["string", "null"] },
        location:   { bsonType: ["string", "null"] },
        deviceId:   { bsonType: ["objectId", "null"] },
      },
    },
  },
});
db.shiftschedules.createIndex({ staffId: 1, date: 1 });
db.shiftschedules.createIndex({ date: 1, shiftType: 1 });

// ============================================================
// 23. SHIFT (CLEAN - bỏ các field không dùng)
// ============================================================
// BỎ: shiftType, startTime, endTime, breakMinutes, overtimeHours,
//      handoverNote, handoverTo, handoverAt
// GIỮ: name, staffId, startAt, endAt, status, note, totalSessions,
//      totalRevenue, totalIncidents, deviceId, location
// ============================================================
db.createCollection("shifts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "staffId", "startAt", "status"],
      properties: {
        name:        { bsonType: "string" },
        staffId:     { bsonType: "objectId" },
        startAt:     { bsonType: "date" },
        endAt:       { bsonType: ["date", "null"] },
        status:      { enum: ["Đang làm", "Đã kết thúc"] },
        note:        { bsonType: ["string", "null"] },
        totalSessions:   { bsonType: "int", minimum: 0 },
        totalRevenue:    { bsonType: "number", minimum: 0 },
        totalIncidents:  { bsonType: "int", minimum: 0 },
        deviceId:     { bsonType: ["objectId", "null"] },
        location:     { bsonType: ["string", "null"] },
      },
    },
  },
});
db.shifts.createIndex({ staffId: 1 });
db.shifts.createIndex({ status: 1 });
db.shifts.createIndex({ startAt: -1 });

// ============================================================
// 24. PARKING EXTENSION (BỎ)
// ============================================================
// ⚠️  MODEL NÀY KHÔNG ĐƯỢC TẠO (KHÔNG CÓ CONTROLLER/SERVICE)
// Tất cả logic gia hạn hiện đang làm trực tiếp trên ParkingSession
// (xem controllers/public.controller.ts:517-620)

// ============================================================
// SUMMARY
// ============================================================
print("============================================");
print("✅ MongoDB Clean Schema created successfully!");
print("============================================");
print("Total collections: 23");
print("Models REMOVED: ParkingExtension (no logic - inline into ParkingSession)");
print("");
print("Changes summary:");
print("  - User: bỏ 12 field auth/profile không dùng");
print("  - Vehicle: bỏ 3 field (notes, imageUrl, ownerIdCard)");
print("  - ParkingSession: bỏ duplicate dailyBreakdown, thêm enum paymentStatus");
print("  - Transaction: bỏ 18 field refund/bank/currency không dùng");
print("  - Subscription: bỏ deprecated registeredPlates");
print("  - SubscriptionPlan: đổi maxVehicles -1 → null (cleaner)");
print("  - Incident: bỏ 14 field extended không dùng");
print("  - PaymentConfig: bỏ payosChecksumKey");
print("  - Shift: bỏ 6 field handover/overtime không dùng");
print("  - PenaltyConfig: bỏ enum 1 giá trị");
print("");
print("📋 Collections:");
db.getCollectionNames().sort().forEach((c) => {
  print("  - " + c);
});
print("============================================");

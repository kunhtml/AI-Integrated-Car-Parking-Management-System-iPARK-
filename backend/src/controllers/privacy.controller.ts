import { Request, Response } from "express";
import { User } from "../models/User.js";
import { Vehicle } from "../models/Vehicle.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";
import { RecognitionLog } from "../models/RecognitionLog.js";

/**
 * GET /api/privacy/export
 * Export all data for the authenticated user as a JSON download.
 */
export async function exportUserData(request: Request, response: Response) {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "Chưa xác thực." });
    return;
  }

  const [user, vehicles, parkingSessions, transactions, recognitionLogs] =
    await Promise.all([
      User.findById(userId).select("-passwordHash -twoFactorSecret -twoFactorPendingSecret").lean(),
      Vehicle.find({ userId }).lean(),
      ParkingSession.find({ ownerUserId: userId }).lean(),
      Transaction.find({ userId }).lean(),
      RecognitionLog.find({ createdBy: userId }).lean(),
    ]);

  if (!user) {
    response.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    user,
    vehicles,
    parkingSessions,
    transactions,
    recognitionLogs,
  };

  response.setHeader("Content-Type", "application/json");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="ipark-data-export-${userId}.json"`,
  );
  response.json(exportData);
}

/**
 * DELETE /api/privacy/delete
 * Anonymize / delete all personal data for the authenticated user.
 */
export async function deleteUserData(request: Request, response: Response) {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "Chưa xác thực." });
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    response.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }

  const anonymizedId = `anonymized-${userId.toString().slice(-6)}`;

  // 1. Anonymize user profile
  await User.findByIdAndUpdate(userId, {
    name: anonymizedId,
    email: `${anonymizedId}@deleted.local`,
    phone: undefined,
    firstName: undefined,
    lastName: undefined,
    gender: undefined,
    dob: undefined,
    idCardNumber: undefined,
    idCardIssueDate: undefined,
    idCardExpiryDate: undefined,
    address: undefined,
    city: undefined,
    district: undefined,
    emergencyContactName: undefined,
    emergencyContactPhone: undefined,
    company: undefined,
    taxId: undefined,
    avatarUrl: undefined,
    googleId: undefined,
    twoFactorSecret: undefined,
    twoFactorPendingSecret: undefined,
    twoFactorEnabled: false,
    provider: "local",
    memberCode: undefined,
  });

  // 2. Delete vehicles
  const deletedVehicles = await Vehicle.deleteMany({ userId });

  // 3. Anonymize parking sessions
  await ParkingSession.updateMany(
    { ownerUserId: userId },
    {
      ownerName: anonymizedId,
      ownerEmail: `${anonymizedId}@deleted.local`,
      entryImageUrl: undefined,
      exitImageUrl: undefined,
      entryDetectedPlate: undefined,
      exitDetectedPlate: undefined,
      aiRawText: undefined,
    },
  );

  // 4. Anonymize transactions (keep financial records for accounting, remove personal info)
  await Transaction.updateMany(
    { userId },
    {
      accountName: undefined,
      accountNumber: undefined,
      content: undefined,
      note: undefined,
    },
  );

  // 5. Anonymize recognition logs
  await RecognitionLog.updateMany(
    { createdBy: userId },
    {
      plate: undefined,
      detectedPlate: undefined,
      rawText: undefined,
      imageUrl: undefined,
      imageHash: undefined,
    },
  );

  response.json({
    message: "Đã xóa / ẩn danh hóa toàn bộ dữ liệu cá nhân của bạn.",
    summary: {
      userAnonymized: true,
      vehiclesDeleted: deletedVehicles.deletedCount,
      sessionsAnonymized: true,
      transactionsAnonymized: true,
      recognitionLogsAnonymized: true,
    },
  });
}

/**
 * GET /api/privacy/settings
 * Return current privacy data status for the authenticated user.
 */
export async function getPrivacySettings(request: Request, response: Response) {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "Chưa xác thực." });
    return;
  }

  const [user, vehicleCount, sessionCount, transactionCount, logCount] =
    await Promise.all([
      User.findById(userId)
        .select("name email phone avatarUrl twoFactorEnabled createdAt")
        .lean(),
      Vehicle.countDocuments({ userId }),
      ParkingSession.countDocuments({ ownerUserId: userId }),
      Transaction.countDocuments({ userId }),
      RecognitionLog.countDocuments({ createdBy: userId }),
    ]);

  if (!user) {
    response.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }

  response.json({
    user: {
      name: user.name,
      email: user.email,
      hasPhone: !!user.phone,
      hasAvatar: !!user.avatarUrl,
      twoFactorEnabled: user.twoFactorEnabled,
      memberSince: user.createdAt,
    },
    dataSummary: {
      vehicles: vehicleCount,
      parkingSessions: sessionCount,
      transactions: transactionCount,
      recognitionLogs: logCount,
    },
    privacyActions: {
      exportAvailable: true,
      deletionAvailable: true,
    },
  });
}

/**
 * ONE-SHOT MIGRATION SCRIPT
 * -------------------------
 * Mục tiêu: chuyển schema Subscription từ "1 gói = nhiều xe" sang "1 gói = 1 xe".
 * Sau migration:
 *   - Subscription có `primaryVehicleId` (ObjectId, unique sparse) thay cho `registeredVehicleIds[]`.
 *   - Subscription có `memberCode` (string IPK-XXXXXX, unique sparse) — chuyển từ User sang đây.
 *   - User không còn `memberCode`.
 *
 * Cách chạy: `node src/scripts/migrate_per_vehicle_subscription.js`
 * BACKUP DB trước khi chạy. Idempotent: chạy lại sẽ skip các sub đã có primaryVehicleId.
 */

import mongoose from "mongoose";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import "../models/Vehicle.js"; // ensure model registered

const DB_NAME = process.env.DB_NAME || "ipark";
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  `mongodb://127.0.0.1:27017/${DB_NAME}`;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ 0/O/1/I

function genMemberCode(existing = new Set()) {
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    const code = `IPK-${suffix}`;
    if (!existing.has(code)) return code;
  }
  throw new Error("Cannot generate unique memberCode after 10 attempts");
}

async function ensureUniqueCode(indexed = []) {
  const set = new Set(indexed);
  return () => genMemberCode(set);
}

async function main() {
  console.log("[migrate] Connecting to", MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log("[migrate] Connected.");

  const stats = { scanned: 0, migrated: 0, skipped: 0, split: 0, deletedUserCode: 0 };

  const allCodes = await Subscription.distinct("memberCode", { memberCode: { $ne: null } });
  const allUserCodes = await User.distinct("memberCode", { memberCode: { $ne: null } });
  console.log(
    `[migrate] Loaded ${allCodes.length} existing sub.memberCode and ${allUserCodes.length} existing user.memberCode.`,
  );

  const allKnownCodes = new Set([...allCodes.filter(Boolean), ...allUserCodes.filter(Boolean)]);
  const nextCode = await ensureUniqueCode([...allKnownCodes]);

  const subs = await Subscription.find({}).sort({ createdAt: 1 });
  stats.scanned = subs.length;
  console.log(`[migrate] Found ${subs.length} subscription(s) to process.`);

  for (const sub of subs) {
    if (sub.primaryVehicleId) {
      // Đã migrate rồi → bỏ qua.
      stats.skipped += 1;
      continue;
    }

    const oldVehicles = Array.isArray(sub.registeredVehicleIds)
      ? sub.registeredVehicleIds.map((id) => String(id)).filter(Boolean)
      : [];

    if (oldVehicles.length === 0) {
      // Sub không gắn xe → skip + cảnh báo admin review manual.
      console.warn(
        `[migrate] Subscription ${sub._id} (userId=${sub.userId}) has no registeredVehicleIds, skipping.`,
      );
      stats.skipped += 1;
      continue;
    }

    // Lấy vehicle đầu tiên làm primary cho sub hiện tại.
    const [firstVehicleId, ...extraVehicleIds] = oldVehicles;

    // Gán memberCode nếu chưa có.
    if (!sub.memberCode) {
      sub.memberCode = nextCode();
      allKnownCodes.add(sub.memberCode);
    }

    sub.primaryVehicleId = new mongoose.Types.ObjectId(firstVehicleId);
    sub.registeredVehicleIds = undefined;
    await sub.save();
    stats.migrated += 1;

    // Với mỗi vehicle thừa → tạo sub mới (cùng plan/status/endDate/renewalCount).
    for (const extraId of extraVehicleIds) {
      const extraSub = new Subscription({
        userId: sub.userId,
        planId: sub.planId,
        planName: sub.planName,
        startDate: sub.startDate,
        endDate: sub.endDate,
        status: sub.status,
        autoRenew: sub.autoRenew,
        renewalCount: sub.renewalCount,
        transactionId: sub.transactionId,
        primaryVehicleId: new mongoose.Types.ObjectId(extraId),
        memberCode: nextCode(),
      });
      await extraSub.save();
      allKnownCodes.add(extraSub.memberCode);
      stats.split += 1;
      console.log(`[migrate]  Split: created new sub ${extraSub._id} for vehicle ${extraId}`);
    }
  }

  // Xóa memberCode trên User (chuyển sang Subscription).
  const userUpdate = await User.updateMany(
    { memberCode: { $exists: true, $ne: null } },
    { $unset: { memberCode: 1 } },
  );
  stats.deletedUserCode = userUpdate.modifiedCount || 0;
  console.log(
    `[migrate] Removed memberCode from ${stats.deletedUserCode} user(s).`,
  );

  // Xóa index cũ (uniq_user_active_or_pending) + đăng ký index mới.
  try {
    await Subscription.collection.dropIndex("uniq_user_active_or_pending");
    console.log("[migrate] Dropped old index uniq_user_active_or_pending.");
  } catch (err) {
    console.log("[migrate] Note: drop old index skipped (likely already gone):", err?.message);
  }

  try {
    await Subscription.syncIndexes();
    console.log("[migrate] Synced subscription indexes.");
  } catch (err) {
    console.warn("[migrate] syncIndexes warning:", err?.message);
  }

  try {
    await User.syncIndexes();
    console.log("[migrate] Synced user indexes.");
  } catch (err) {
    console.warn("[migrate] syncIndexes user warning:", err?.message);
  }

  console.log("\n[migrate] ===== SUMMARY =====");
  console.log(JSON.stringify(stats, null, 2));
  console.log("[migrate] Done.\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});

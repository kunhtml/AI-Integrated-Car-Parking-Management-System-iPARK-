/**
 * CLEANUP — xóa Subscription cũ có primaryVehicleId = null.
 *
 * Lý do xuất hiện: các sub được tạo trước migration sang per-vehicle schema
 * không có primaryVehicleId. Khi migration_per_vehicle chạy, sub có
 * `registeredVehicleIds` rỗng đã được skip. Cần clean thủ công.
 *
 * Chạy: node src/scripts/cleanup_null_vehicle_subscriptions.js
 *
 * Backup DB trước khi chạy.
 */

import mongoose from "mongoose";
import { Subscription } from "../models/Subscription.js";
import { Transaction } from "../models/Transaction.js";

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  `mongodb://127.0.0.1:27017/${process.env.DB_NAME || "ipark"}`;

async function main() {
  console.log("[cleanup] Connecting to", MONGO_URI);
  await mongoose.connect(MONGO_URI);

  const orphans = await Subscription.find({
    $or: [{ primaryVehicleId: null }, { primaryVehicleId: { $exists: false } }],
  });

  console.log(`[cleanup] Found ${orphans.length} orphan subscription(s) (no primaryVehicleId).`);

  if (orphans.length === 0) {
    console.log("[cleanup] Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  for (const sub of orphans) {
    const txCount = await Transaction.deleteMany({ subscriptionId: sub._id });
    await Subscription.deleteOne({ _id: sub._id });
    console.log(
      `[cleanup] Deleted sub ${sub._id} (userId=${sub.userId}, status=${sub.status}, planName="${sub.planName}") + ${txCount.deletedCount} transaction(s).`,
    );
  }

  try {
    await Subscription.syncIndexes();
    console.log("[cleanup] Synced subscription indexes.");
  } catch (err) {
    console.warn("[cleanup] syncIndexes warning:", err?.message);
  }

  console.log("[cleanup] Done.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[cleanup] FAILED:", err);
  process.exit(1);
});

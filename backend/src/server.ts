import { app } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { initScheduler } from "./services/scheduler.service.js";
import {
  migrateLegacySubscriptionPlates,
} from "./services/subscription.service.js";

await connectDb();

// One-shot migration: chuyển Subscription.registeredPlates (string[]) cũ
// sang registeredVehicleIds (ObjectId[]). Chạy lúc khởi động server.
try {
  const result = await migrateLegacySubscriptionPlates();
  if (result.scanned > 0) {
    console.log(
      `[Migration] Subscriptions: scanned=${result.scanned} updated=${result.updated} vehiclesCreated=${result.vehiclesCreated}`,
    );
  }
} catch (err) {
  console.error("[Migration] migrateLegacySubscriptionPlates failed:", err);
}

// Backfill tự động chuyển sang script riêng: scripts/migrate_per_vehicle_subscription.js
// (đã chạy 1 lần khi chuyển schema). Giữ legacy no-op ở đây cho tương thích.

app.listen(env.port, () => {
  console.log(`iPARK backend listening on http://localhost:${env.port}`);
  initScheduler();
});

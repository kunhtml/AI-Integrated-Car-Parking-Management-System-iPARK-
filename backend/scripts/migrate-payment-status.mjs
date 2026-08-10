import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ParkingSession } from "../src/models/ParkingSession.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  // Fix stale paymentStatus values: "paid" → "fully_paid"
  const paidResult = await ParkingSession.updateMany(
    { paymentStatus: "paid" },
    { $set: { paymentStatus: "fully_paid" } },
  );
  console.log(`Fixed ${paidResult.modifiedCount} sessions: "paid" → "fully_paid"`);

  // Fix stale paymentStatus values: "pending" → "unpaid"
  const pendingResult = await ParkingSession.updateMany(
    { paymentStatus: "pending" },
    { $set: { paymentStatus: "unpaid" } },
  );
  console.log(`Fixed ${pendingResult.modifiedCount} sessions: "pending" → "unpaid"`);

  // Verify final state
  const counts = await ParkingSession.aggregate([
    { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
  ]);
  console.log("Final paymentStatus distribution:", counts);

  await mongoose.disconnect();
  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});

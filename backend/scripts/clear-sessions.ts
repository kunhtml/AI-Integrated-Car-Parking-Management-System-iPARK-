/* eslint-disable no-console */
/**
 * CLEAR TOÀN BỘ DATA PARKING SESSION
 * - Xóa: ParkingSession, Transaction (sessionId != null),
 *        Penalty, Reservation, Incident, ParkingCameraLog (sessionId != null)
 * - Reset slot về trạng thái "empty" + clear currentSessionId
 *
 * KHÔNG xóa: User, Vehicle, ActiveSession (login session), PricingConfig,
 *            Subscription, Zone, Device, RfidCard, ...
 *
 * Chạy:  npx tsx scripts/clear-sessions.ts
 *   hoặc: npx tsx scripts/clear-sessions.ts --yes   (bỏ qua confirm)
 */

import "dotenv/config";
import mongoose from "mongoose";
import readline from "node:readline";

import { ParkingSession } from "../src/models/ParkingSession.js";
import { Transaction } from "../src/models/Transaction.js";
import { Penalty } from "../src/models/Penalty.js";
import { Reservation } from "../src/models/Reservation.js";
import { Incident } from "../src/models/Incident.js";
import { ParkingCameraLog } from "../src/models/ParkingCameraLog.js";
import { ParkingSlot } from "../src/models/ParkingSlot.js";

const CONFIRM_TEXT = "YES CLEAR SESSIONS";

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() === CONFIRM_TEXT);
    });
  });
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!mongoUri) throw new Error("MONGODB_URI missing in .env");

  await mongoose.connect(mongoUri, dbName ? { dbName } : undefined);
  console.log(`[clear-sessions] connected → db=${mongoose.connection.name}`);

  const skipConfirm = process.argv.includes("--yes");
  if (!skipConfirm) {
    const ok = await confirm(
      `⚠  Sẽ XÓA toàn bộ parking sessions + payments + logs + reset slots.\n` +
      `   KHÔNG xóa users / vehicles / pricing.\n` +
      `   Gõ "${CONFIRM_TEXT}" để xác nhận: `,
    );
    if (!ok) {
      console.log("Đã huỷ.");
      await mongoose.disconnect();
      return;
    }
  }

  const stats = {};

  // 1. Parking sessions
  const sessAll = await ParkingSession.find({}, { _id: 1 }).lean();
  const sessIds = sessAll.map((s) => s._id);
  const s = await ParkingSession.deleteMany({ _id: { $in: sessIds } });
  stats.parkingSessions = s.deletedCount;

  // 2. Transactions liên quan session
  const t = await Transaction.deleteMany({ sessionId: { $in: sessIds, $ne: null } });
  stats.transactions = t.deletedCount;

  // 3. Penalties liên quan session
  const p = await Penalty.deleteMany({ sessionId: { $in: sessIds, $ne: null } });
  stats.penalties = p.deletedCount;

  // 4. Reservations liên quan session
  const r = await Reservation.deleteMany({ sessionId: { $in: sessIds, $ne: null } });
  stats.reservations = r.deletedCount;

  // 5. Incidents liên quan session
  const i = await Incident.deleteMany({ sessionId: { $in: sessIds, $ne: null } });
  stats.incidents = i.deletedCount;

  // 6. Camera logs liên quan session
  const c = await ParkingCameraLog.deleteMany({ sessionId: { $in: sessIds, $ne: null } });
  stats.cameraLogs = c.deletedCount;

  // 7. Reset slot state (chỉ những slot đang trỏ tới session bị xoá)
  const slot = await ParkingSlot.updateMany(
    { currentSessionId: { $in: sessIds } },
    {
      $set: {
        status: "empty",
        currentSessionId: null,
      },
    },
  );
  stats.slotsReset = slot.modifiedCount;

  console.log("\n✅ DONE");
  console.table(stats);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[clear-sessions] failed:", err);
  process.exit(1);
});
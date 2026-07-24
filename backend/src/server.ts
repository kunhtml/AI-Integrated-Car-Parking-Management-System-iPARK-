import { app } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { initAutoScan, stopAllAutoScan } from "./services/auto-scan.service.js";
import { startDetectWorker, stopDetectWorker } from "./queues/detect.queue.js";

await connectDb();

// Khởi động auto-scan cho các camera entry đã bật
await initAutoScan();

// Khởi động worker xử lý nhận diện bất đồng bộ (ONVIF motion, camera events)
// Worker đảm bảo mọi detection đều ghi nhận detectionMethod (plate-model ưu tiên)
startDetectWorker();

const server = app.listen(env.port, () => {
  console.log(`iPARK backend listening on http://localhost:${env.port}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  stopAllAutoScan();
  await stopDetectWorker();
  server.close(() => process.exit(0));
});

process.on("SIGINT", async () => {
  stopAllAutoScan();
  await stopDetectWorker();
  server.close(() => process.exit(0));
});

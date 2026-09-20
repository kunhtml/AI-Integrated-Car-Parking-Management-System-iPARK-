import { connectDb } from "./src/config/db.js";
import { pushCameraLog } from "./src/controllers/camera-bridge.controller.js";
import { cameraEventBus } from "./src/services/camera-event-bus.js";
import { Response } from "express";

async function main() {
  await connectDb();
  let captured: any = null;
  cameraEventBus.subscribe((event) => {
    captured = event;
  });
  const body = {
    direction: "in" as const,
    detectedPlate: "30E92291",
    confidence: 0.93,
    userType: "resident" as const,
  };
  const req: any = { body };
  const res: any = {
    statusCode: 0,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  await pushCameraLog(req as any, res as Response);
  console.log("RESPONSE:", JSON.stringify(res.body));
  console.log("EMIT METADATA:", JSON.stringify(captured?.metadata, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});

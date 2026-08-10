import { Router } from "express";
import {
  bridgeGateControl,
  bridgeHealth,
  clearCameraLogs,
  listCameraLogs,
  pushCameraLog,
} from "../controllers/camera-bridge.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireServiceToken } from "../middlewares/service-auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Bridge endpoints (Python service) - dùng service token, KHÔNG cần session
export const cameraBridgeRoutes = Router();
cameraBridgeRoutes.use(requireServiceToken);
cameraBridgeRoutes.get("/health", asyncHandler(bridgeHealth));
cameraBridgeRoutes.post("/log", asyncHandler(pushCameraLog));
cameraBridgeRoutes.post("/gate/:direction/:action", asyncHandler(bridgeGateControl));

// Admin/staff xem logs
const cameraBridgeAdminRoutes = Router();
cameraBridgeAdminRoutes.use(requireAuth);
cameraBridgeAdminRoutes.get("/logs", requireRole("admin", "staff"), asyncHandler(listCameraLogs));
cameraBridgeAdminRoutes.delete("/logs", requireRole("admin"), asyncHandler(clearCameraLogs));

export { cameraBridgeAdminRoutes };
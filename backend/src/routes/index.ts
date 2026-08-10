import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { devicesRoutes } from "./devices.routes.js";
import { incidentsRoutes } from "./incidents.routes.js";
import { notificationsRoutes } from "./notifications.routes.js";
import { notificationTemplatesRoutes } from "./notificationTemplates.routes.js";
import { parkingSessionsRoutes } from "./parkingSessions.routes.js";
import { parkingSlotsRoutes } from "./parkingSlots.routes.js";
import { pricingConfigRoutes } from "./pricingConfig.routes.js";
import { reportsRoutes } from "./reports.routes.js";
import { reservationsRoutes } from "./reservations.routes.js";
import { shiftsRoutes } from "./shifts.routes.js";
import { shiftScheduleRoutes } from "./shift-schedules.routes.js";
import { subscriptionsRoutes } from "./subscriptions.routes.js";
import { transactionsRoutes } from "./transactions.routes.js";
import { usersRoutes } from "./users.routes.js";
import { vehiclesRoutes } from "./vehicles.routes.js";
import { vehicleRequestsRoutes } from "./vehicleRequests.routes.js";
import { zonesRoutes } from "./zones.routes.js";
import { payosRoutes } from "./payos.routes.js";
import { aiRoutes } from "./ai.routes.js";
import { penaltiesRoutes } from "./penalties.routes.js";
import { rfidRoutes, bridgeRfid } from "./rfid.routes.js";
import { cameraBridgeAdminRoutes, cameraBridgeRoutes } from "./camera-bridge.routes.js";
import { uploadsRoutes } from "./uploads.routes.js";
import { capacityConfigRoutes } from "./capacityConfig.routes.js";

export const apiRoutes = Router();

apiRoutes.get("/health", (_request, response) => response.json({ ok: true, service: "ipark-backend" }));

// Public endpoints (no auth)
import {
  publicAvailability,
  publicSearch,
  lookupSession,
  quickLookup,
  calculateExitFee,
  calculateFeeQuick,
  preCheckout,
  confirmPayment,
  extendSession,
  checkSessionPaymentStatus,
  publicPricingConfig,
  publicSubscriptionPlans,
} from "../controllers/public.controller.js";

apiRoutes.get("/public/availability", publicAvailability);
apiRoutes.get("/public/search", publicSearch);
apiRoutes.get("/public/lookup", lookupSession);
apiRoutes.get("/public/quick-lookup", quickLookup);
apiRoutes.get("/public/session/:sessionId/payment-status", checkSessionPaymentStatus);

// Pre-checkout & payment endpoints (no auth)
apiRoutes.post("/public/calculate-fee", calculateExitFee);
apiRoutes.post("/public/calculate-fee-quick", calculateFeeQuick);
apiRoutes.post("/public/pre-checkout", preCheckout);
apiRoutes.post("/public/confirm-payment", confirmPayment);
apiRoutes.post("/public/extend-session", extendSession);

// Public pricing & plans (no auth)
apiRoutes.get("/public/pricing", publicPricingConfig);
apiRoutes.get("/public/subscription-plans", publicSubscriptionPlans);

// Bridge endpoints (Python smart_parking_rut_gon service)
// Service token-based auth, không cần session
apiRoutes.use("/bridge", cameraBridgeRoutes);
apiRoutes.use("/rfid-bridge", bridgeRfid);

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/users", usersRoutes);
apiRoutes.use("/vehicles", vehiclesRoutes);
apiRoutes.use("/vehicle-requests", vehicleRequestsRoutes);
apiRoutes.use("/zones", zonesRoutes);
apiRoutes.use("/parking-slots", parkingSlotsRoutes);
apiRoutes.use("/parking-sessions", parkingSessionsRoutes);
apiRoutes.use("/pricing-config", pricingConfigRoutes);
apiRoutes.use("/reports", reportsRoutes);
apiRoutes.use("/transactions", transactionsRoutes);
apiRoutes.use("/devices", devicesRoutes);
apiRoutes.use("/reservations", reservationsRoutes);
apiRoutes.use("/subscriptions", subscriptionsRoutes);
apiRoutes.use("/notifications", notificationsRoutes);
apiRoutes.use("/notification-templates", notificationTemplatesRoutes);
apiRoutes.use("/shifts", shiftsRoutes);
apiRoutes.use("/shift-schedules", shiftScheduleRoutes);
apiRoutes.use("/incidents", incidentsRoutes);
apiRoutes.use("/payos", payosRoutes);
apiRoutes.use("/ai", aiRoutes);
apiRoutes.use("/penalties", penaltiesRoutes);
apiRoutes.use("/rfid", rfidRoutes);
apiRoutes.use("/camera-logs", cameraBridgeAdminRoutes);
apiRoutes.use("/uploads", uploadsRoutes);
apiRoutes.use("/capacity-config", capacityConfigRoutes);

import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { devicesRoutes } from "./devices.routes.js";
import {
  feedbackRoutes,
  incidentsRoutes,
  notificationsRoutes,
  reportsRoutes,
  shiftsRoutes,
} from "./misc.routes.js";
import { membershipPackagesRoutes } from "./membershipPackages.routes.js";
import { parkingSessionsRoutes } from "./parkingSessions.routes.js";
import { paymentConfigRoutes } from "./paymentConfig.routes.js";
import { pricingConfigRoutes } from "./pricingConfig.routes.js";
import { pricingRoutes } from "./pricing.routes.js";
import { recognitionLogsRoutes } from "./recognitionLogs.routes.js";
import { revenueReportsRoutes } from "./revenueReports.routes.js";
import { transactionsRoutes } from "./transactions.routes.js";
import { usersRoutes } from "./users.routes.js";
import { vehiclesRoutes } from "./vehicles.routes.js";
import { zonesRoutes } from "./zones.routes.js";
import { rfidRoutes } from "./rfid.routes.js";
import { backupRoutes } from "./backup.routes.js";
import { auditLogRoutes } from "./auditLog.routes.js";
import { assistedRegistrationRoutes } from "./assistedRegistration.routes.js";
import { privacyRoutes } from "./privacy.routes.js";
import { rfidReportRoutes } from "./rfidReport.routes.js";
import { alertsRoutes } from "./alerts.routes.js";
import { invoiceRoutes } from "./invoice.routes.js";

export const apiRoutes = Router();

apiRoutes.get("/health", (_request, response) =>
  response.json({ ok: true, service: "ipark-backend" }),
);
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/dashboard", dashboardRoutes);
apiRoutes.use("/membership-packages", membershipPackagesRoutes);
apiRoutes.use("/users", usersRoutes);
apiRoutes.use("/vehicles", vehiclesRoutes);
apiRoutes.use("/parking-sessions", parkingSessionsRoutes);
apiRoutes.use("/pricing", pricingRoutes);
apiRoutes.use("/pricing-config", pricingConfigRoutes);
apiRoutes.use("/reports/revenue", revenueReportsRoutes);
apiRoutes.use("/recognition-logs", recognitionLogsRoutes);
apiRoutes.use("/reports", reportsRoutes);
apiRoutes.use("/payment-config", paymentConfigRoutes);
apiRoutes.use("/transactions", transactionsRoutes);
apiRoutes.use("/devices", devicesRoutes);
apiRoutes.use("/feedback", feedbackRoutes);
apiRoutes.use("/notifications", notificationsRoutes);
apiRoutes.use("/shifts", shiftsRoutes);
apiRoutes.use("/incidents", incidentsRoutes);
apiRoutes.use("/zones", zonesRoutes);
apiRoutes.use("/rfid-cards", rfidRoutes);
apiRoutes.use("/backups", backupRoutes);
apiRoutes.use("/audit-logs", auditLogRoutes);
apiRoutes.use("/alerts", alertsRoutes);
apiRoutes.use("/privacy", privacyRoutes);
apiRoutes.use("/rfid-reports", rfidReportRoutes);
apiRoutes.use("/invoices", invoiceRoutes);
apiRoutes.use("/assisted-registration", assistedRegistrationRoutes);

import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { membershipPackagesRoutes } from "./membershipPackages.routes.js";
import { parkingSessionsRoutes } from "./parkingSessions.routes.js";
import { pricingRoutes } from "./pricing.routes.js";
import { revenueReportsRoutes } from "./revenueReports.routes.js";
import { usersRoutes } from "./users.routes.js";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/dashboard", dashboardRoutes);
apiRoutes.use("/membership-packages", membershipPackagesRoutes);
apiRoutes.use("/parking-sessions", parkingSessionsRoutes);
apiRoutes.use("/pricing", pricingRoutes);
apiRoutes.use("/reports/revenue", revenueReportsRoutes);
apiRoutes.use("/users", usersRoutes);

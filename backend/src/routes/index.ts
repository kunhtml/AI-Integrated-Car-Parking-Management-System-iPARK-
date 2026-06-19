import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { parkingSessionsRoutes } from "./parkingSessions.routes.js";
import { pricingRoutes } from "./pricing.routes.js";
import { usersRoutes } from "./users.routes.js";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/dashboard", dashboardRoutes);
apiRoutes.use("/parking-sessions", parkingSessionsRoutes);
apiRoutes.use("/pricing", pricingRoutes);
apiRoutes.use("/users", usersRoutes);

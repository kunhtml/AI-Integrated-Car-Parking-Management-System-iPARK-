import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { feedbackRoutes } from "./feedback.routes.js";
import { parkingSessionsRoutes } from "./parkingSessions.routes.js";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/feedback", feedbackRoutes);
apiRoutes.use("/parking-sessions", parkingSessionsRoutes);

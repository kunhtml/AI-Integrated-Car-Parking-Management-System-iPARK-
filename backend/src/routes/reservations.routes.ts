import { Router } from "express";
import {
  cancelReservationHandler,
  confirmReservationHandler,
  createReservationHandler,
  expireReservationsHandler,
  listReservationsHandler,
  myReservationsHandler,
} from "../controllers/reservations.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const reservationsRoutes = Router();

reservationsRoutes.get("/", requireAuth, requireRole("admin", "staff"), asyncHandler(listReservationsHandler));
reservationsRoutes.get("/my", requireAuth, asyncHandler(myReservationsHandler));
reservationsRoutes.post("/", requireAuth, asyncHandler(createReservationHandler));
reservationsRoutes.post("/expire", requireAuth, requireRole("admin"), asyncHandler(expireReservationsHandler));
reservationsRoutes.post("/:id/cancel", requireAuth, asyncHandler(cancelReservationHandler));
reservationsRoutes.post("/:id/confirm", requireAuth, requireRole("admin", "staff"), asyncHandler(confirmReservationHandler));

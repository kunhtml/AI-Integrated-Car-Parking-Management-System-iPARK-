import { Router } from "express";
import {
  cancelMyStaffApplication,
  createStaffApplication,
  getMyStaffApplication,
  getMyStaffApplicationHistory,
  getStaffApplicationHistory,
  listStaffApplications,
  resubmitMyStaffApplication,
  reviewStaffApplication,
  saveMyStaffApplication,
} from "../controllers/staffApplications.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const staffApplicationsRoutes = Router();

staffApplicationsRoutes.use(requireAuth);
staffApplicationsRoutes.get("/me", asyncHandler(getMyStaffApplication));
staffApplicationsRoutes.post(
  "/",
  requireRole("customer"),
  asyncHandler(createStaffApplication),
);
staffApplicationsRoutes.patch(
  "/me/cancel",
  requireRole("customer"),
  asyncHandler(cancelMyStaffApplication),
);
staffApplicationsRoutes.patch(
  "/:id",
  requireRole("customer"),
  asyncHandler(saveMyStaffApplication),
);
staffApplicationsRoutes.post(
  "/:id/resubmit",
  requireRole("customer"),
  asyncHandler(resubmitMyStaffApplication),
);
staffApplicationsRoutes.get(
  "/:id/history",
  requireRole("customer"),
  asyncHandler(getMyStaffApplicationHistory),
);
staffApplicationsRoutes.get(
  "/",
  requireRole("admin"),
  asyncHandler(listStaffApplications),
);
staffApplicationsRoutes.get(
  "/:id/history/admin",
  requireRole("admin"),
  asyncHandler(getStaffApplicationHistory),
);
staffApplicationsRoutes.patch(
  "/:id/review",
  requireRole("admin"),
  asyncHandler(reviewStaffApplication),
);

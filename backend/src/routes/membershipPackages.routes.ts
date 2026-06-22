import { Router } from "express";
import {
  createMembershipPackage,
  listMembershipPackages,
  updateMembershipPackage,
} from "../controllers/membershipPackages.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const membershipPackagesRoutes = Router();

membershipPackagesRoutes.use(requireAuth, requireRole("admin", "staff"));
membershipPackagesRoutes.get("/", asyncHandler(listMembershipPackages));
membershipPackagesRoutes.post("/", asyncHandler(createMembershipPackage));
membershipPackagesRoutes.patch("/:id", asyncHandler(updateMembershipPackage));

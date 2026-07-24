import { Router } from "express";
import {
  createMembershipPackage,
  listMembershipPackages,
  updateMembershipPackage,
} from "../controllers/membershipPackages.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const membershipPackagesRoutes = Router();

membershipPackagesRoutes.use(requireAuth);

membershipPackagesRoutes.get("/", asyncHandler(listMembershipPackages));
membershipPackagesRoutes.post("/", requireRole("admin", "staff"), asyncHandler(createMembershipPackage));
membershipPackagesRoutes.patch("/:id", requireRole("admin", "staff"), asyncHandler(updateMembershipPackage));

import { Router } from "express";
import {
  listPenalties,
  createPenalty,
  updatePenaltyStatus,
  payPenalty,
  listPenaltyConfigs,
  upsertPenaltyConfig,
} from "../controllers/penalties.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const penaltiesRoutes = Router();

penaltiesRoutes.use(requireAuth, requireRole("admin", "staff"));

// Bảng giá phạt (chỉ admin sửa)
penaltiesRoutes.get("/config", asyncHandler(listPenaltyConfigs));
penaltiesRoutes.put("/config", requireRole("admin"), asyncHandler(upsertPenaltyConfig));

// Vé phạt
penaltiesRoutes.get("/", asyncHandler(listPenalties));
penaltiesRoutes.post("/", asyncHandler(createPenalty));
penaltiesRoutes.post("/:id/pay", asyncHandler(payPenalty));
penaltiesRoutes.patch("/:id", asyncHandler(updatePenaltyStatus));

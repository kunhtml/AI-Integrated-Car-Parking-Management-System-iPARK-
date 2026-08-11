import { Router } from "express";
import {
  addDisputeMessage,
  cancelDispute,
  createDispute,
  getDispute,
  getDisputeByCode,
  listDisputeReferences,
  listDisputes,
  updateDispute,
} from "../controllers/disputes.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const disputesRoutes = Router();

disputesRoutes.use(requireAuth);

disputesRoutes.get(
  "/references",
  requireRole("customer"),
  asyncHandler(listDisputeReferences),
);
disputesRoutes.get("/", asyncHandler(listDisputes));
disputesRoutes.get("/by-code/:code", asyncHandler(getDisputeByCode));
disputesRoutes.get("/:id", asyncHandler(getDispute));
disputesRoutes.post("/", requireRole("customer"), asyncHandler(createDispute));
disputesRoutes.patch(
  "/:id",
  requireRole("admin", "staff"),
  asyncHandler(updateDispute),
);
disputesRoutes.delete(
  "/:id",
  requireRole("customer"),
  asyncHandler(cancelDispute),
);
disputesRoutes.post("/:id/messages", asyncHandler(addDisputeMessage));

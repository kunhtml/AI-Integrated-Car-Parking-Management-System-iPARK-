import { Router } from "express";
import { createFeedback, listFeedback, updateFeedback } from "../controllers/feedback.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const feedbackRoutes = Router();

feedbackRoutes.use(requireAuth);
feedbackRoutes.get("/", asyncHandler(listFeedback));
feedbackRoutes.post("/", asyncHandler(createFeedback));
feedbackRoutes.patch("/:id", requireRole("admin"), asyncHandler(updateFeedback));

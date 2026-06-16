import { Router } from "express";
import { listUsers, updateUser } from "../controllers/users.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const usersRoutes = Router();

usersRoutes.use(requireAuth, requireRole("admin"));
usersRoutes.get("/", asyncHandler(listUsers));
usersRoutes.patch("/", asyncHandler(updateUser));
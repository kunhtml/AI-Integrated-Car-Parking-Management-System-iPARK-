import { Router } from "express";
import { createUser, deleteUser, listUsers, updateUser } from "../controllers/users.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const usersRoutes = Router();

usersRoutes.use(requireAuth, requireRole("admin", "staff"));
usersRoutes.get("/", asyncHandler(listUsers));
usersRoutes.post("/", asyncHandler(createUser));
usersRoutes.patch("/", asyncHandler(updateUser));
usersRoutes.delete("/:id", asyncHandler(deleteUser));

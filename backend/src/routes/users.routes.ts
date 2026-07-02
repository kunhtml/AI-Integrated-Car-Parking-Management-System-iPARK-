import { Router } from "express";
import { createUser, createStaffAccount, deleteUser, listUsers, updateUser } from "../controllers/users.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const usersRoutes = Router();

usersRoutes.use(requireAuth, requireRole("admin"));
usersRoutes.get("/", asyncHandler(listUsers));
usersRoutes.post("/", asyncHandler(createUser));
usersRoutes.post("/staff", asyncHandler(createStaffAccount));
usersRoutes.patch("/", asyncHandler(updateUser));
usersRoutes.put("/:id", asyncHandler(updateUser));
usersRoutes.delete("/:id", asyncHandler(deleteUser));

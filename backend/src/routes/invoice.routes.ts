import { Router } from "express";
import {
  createInvoiceHandler,
  getInvoiceHandler,
  listInvoicesHandler,
  downloadInvoiceHandler,
} from "../controllers/invoice.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const invoiceRoutes = Router();

invoiceRoutes.use(requireAuth);

invoiceRoutes.get("/", asyncHandler(listInvoicesHandler));
invoiceRoutes.post(
  "/",
  requireRole("admin", "staff"),
  asyncHandler(createInvoiceHandler),
);
invoiceRoutes.get("/:id", asyncHandler(getInvoiceHandler));
invoiceRoutes.get("/:id/download", asyncHandler(downloadInvoiceHandler));

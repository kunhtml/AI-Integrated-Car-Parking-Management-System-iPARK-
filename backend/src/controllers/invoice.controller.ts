import { Request, Response } from "express";
import { z } from "zod";
import { Invoice } from "../models/Invoice.js";
import {
  createInvoiceForSession,
  generateInvoiceNumber,
  getInvoice,
  listInvoices,
  updateInvoiceStatus,
} from "../services/invoice.service.js";

const createInvoiceSchema = z.object({
  sessionId: z.string().optional(),
  customerName: z.string().min(1, "Tên khách hàng là bắt buộc."),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  taxId: z.string().optional(),
  amount: z.number().optional(),
  description: z.string().optional(),
});

const listInvoicesQuerySchema = z.object({
  userId: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * POST /api/invoices
 * Create an invoice for a parking session.
 */
export async function createInvoiceHandler(
  request: Request,
  response: Response,
) {
  const body = createInvoiceSchema.parse(request.body);

  if (body.sessionId) {
    // Create invoice linked to a parking session
    const invoice = await createInvoiceForSession(body.sessionId, {
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      customerAddress: body.customerAddress,
      taxId: body.taxId,
    });
    response.status(201).json({ invoice });
    return;
  }

  // Create standalone invoice (no session linked)
  const invoiceNumber = await generateInvoiceNumber();
  const amount = body.amount || 0;
  const invoice = await Invoice.create({
    invoiceNumber,
    customerName: body.customerName,
    customerEmail: body.customerEmail,
    customerPhone: body.customerPhone,
    customerAddress: body.customerAddress,
    taxId: body.taxId,
    items: [
      {
        description: body.description || "Dịch vụ đỗ xe",
        quantity: 1,
        unitPrice: amount,
        amount,
      },
    ],
    subtotal: amount,
    tax: 0,
    total: amount,
    status: "Draft",
  });

  response.status(201).json({ invoice });
}

/**
 * GET /api/invoices/:id
 * Get a single invoice by ID.
 */
export async function getInvoiceHandler(
  request: Request,
  response: Response,
) {
  const invoice = await getInvoice(String(request.params.id));
  if (!invoice) {
    response.status(404).json({ message: "Không tìm thấy hóa đơn." });
    return;
  }

  response.json({ invoice });
}

/**
 * GET /api/invoices
 * List invoices with optional filters.
 */
export async function listInvoicesHandler(
  request: Request,
  response: Response,
) {
  const query = listInvoicesQuerySchema.parse(request.query);

  // Customers can only see their own invoices
  if (request.user?.role === "customer") {
    query.userId = request.user.id;
  }

  const invoices = await listInvoices(query);
  response.json({ invoices });
}

/**
 * GET /api/invoices/:id/download
 * Return invoice data as JSON (PDF generation can be added later).
 */
export async function downloadInvoiceHandler(
  request: Request,
  response: Response,
) {
  const invoice = await getInvoice(String(request.params.id));
  if (!invoice) {
    response.status(404).json({ message: "Không tìm thấy hóa đơn." });
    return;
  }

  response.json({
    invoice,
    format: "json",
    note: "Xuất PDF sẽ được hỗ trợ trong phiên bản sau.",
  });
}

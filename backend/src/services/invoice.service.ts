import mongoose from "mongoose";
import { Invoice, InvoiceDocument } from "../models/Invoice.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";

/**
 * Generate invoice number in format "INV-YYYYMMDD-XXXX"
 * XXXX is a sequential counter per day.
 */
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePart = `${yyyy}${mm}${dd}`;
  const prefix = `INV-${datePart}-`;

  // Count existing invoices today to determine the next sequence number
  const startOfDay = new Date(yyyy, now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(yyyy, now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const count = await Invoice.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const sequence = String(count + 1).padStart(4, "0");
  return `${prefix}${sequence}`;
}

export type CreateInvoiceOpts = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  taxId?: string;
};

/**
 * Create an invoice for a parking session.
 * Looks up the session and its related transaction to build line items.
 */
export async function createInvoiceForSession(
  sessionId: string,
  opts?: CreateInvoiceOpts,
): Promise<InvoiceDocument> {
  if (!mongoose.isValidObjectId(sessionId)) {
    throw Object.assign(new Error("SessionId không hợp lệ."), { status: 400 });
  }

  const session = await ParkingSession.findById(sessionId);
  if (!session) {
    throw Object.assign(new Error("Không tìm thấy phiên đỗ xe."), {
      status: 404,
    });
  }

  // Find the related transaction (if any)
  let transaction = null;
  if (session.transactionId) {
    transaction = await Transaction.findById(session.transactionId);
  }

  // Build line items from fee breakdown
  const items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }> = [];

  const breakdown = session.feeBreakdown;

  if (breakdown?.parkingFee && breakdown.parkingFee > 0) {
    items.push({
      description: `Phí gửi xe - ${session.plate} (${session.vehicleType})`,
      quantity: 1,
      unitPrice: breakdown.parkingFee,
      amount: breakdown.parkingFee,
    });
  }

  if (breakdown?.overdueFine && breakdown.overdueFine > 0) {
    items.push({
      description: `Phí quá giờ - ${session.plate}`,
      quantity: 1,
      unitPrice: breakdown.overdueFine,
      amount: breakdown.overdueFine,
    });
  }

  // If no breakdown or no items were added, use the total fee as a single item
  if (items.length === 0 && session.fee > 0) {
    items.push({
      description: `Phí gửi xe - ${session.plate} (${session.vehicleType})`,
      quantity: 1,
      unitPrice: session.fee,
      amount: session.fee,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await Invoice.create({
    invoiceNumber,
    sessionId: session._id,
    transactionId: transaction?._id,
    userId: session.ownerUserId,
    customerName: opts?.customerName || session.ownerName || "Khách vãng lai",
    customerEmail: opts?.customerEmail || session.ownerEmail,
    customerPhone: opts?.customerPhone,
    customerAddress: opts?.customerAddress,
    taxId: opts?.taxId,
    items,
    subtotal,
    tax: 0,
    total: subtotal,
    status: transaction?.status === "paid" ? "Paid" : "Issued",
    issuedAt: new Date(),
    paidAt: transaction?.status === "paid" ? transaction.paidAt : undefined,
    notes: `Phiên gửi xe ${session._id} | Biển số: ${session.plate} | Slot: ${session.slot}`,
  });

  return invoice;
}

/**
 * Get a single invoice by ID.
 */
export async function getInvoice(invoiceId: string): Promise<InvoiceDocument | null> {
  if (!mongoose.isValidObjectId(invoiceId)) {
    return null;
  }
  return Invoice.findById(invoiceId);
}

export type ListInvoicesOpts = {
  userId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
};

/**
 * List invoices with optional filters.
 */
export async function listInvoices(
  opts: ListInvoicesOpts,
): Promise<InvoiceDocument[]> {
  const criteria: Record<string, any> = {};

  if (opts.userId && mongoose.isValidObjectId(opts.userId)) {
    criteria.userId = new mongoose.Types.ObjectId(opts.userId);
  }

  if (opts.status) {
    criteria.status = opts.status;
  }

  if (opts.from || opts.to) {
    criteria.createdAt = {};
    if (opts.from) {
      criteria.createdAt.$gte = new Date(opts.from);
    }
    if (opts.to) {
      criteria.createdAt.$lte = new Date(opts.to);
    }
  }

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);

  return Invoice.find(criteria).sort({ createdAt: -1 }).limit(limit);
}

/**
 * Update an invoice's status.
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: string,
): Promise<InvoiceDocument | null> {
  if (!mongoose.isValidObjectId(invoiceId)) {
    return null;
  }

  const update: Partial<InvoiceDocument> = { status: status as any };

  if (status === "Paid") {
    update.paidAt = new Date();
  }
  if (status === "Issued") {
    update.issuedAt = new Date();
  }

  return Invoice.findByIdAndUpdate(invoiceId, update, { returnDocument: "after" });
}

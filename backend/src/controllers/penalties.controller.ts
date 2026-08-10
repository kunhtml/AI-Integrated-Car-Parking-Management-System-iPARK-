import { Request, Response } from "express";
import { z } from "zod";
import { Penalty } from "../models/Penalty.js";
import { PenaltyConfig } from "../models/PenaltyConfig.js";
import { ParkingSlot } from "../models/ParkingSlot.js";
import { ParkingSession } from "../models/ParkingSession.js";
import { Transaction } from "../models/Transaction.js";
import { createPayOSPayment } from "../services/payos.service.js";

const VIOLATION_TYPES = ["over_line"] as const;

function serializePenalty(p: InstanceType<typeof Penalty>) {
  return {
    id: p._id.toString(),
    plate: p.plate,
    violationType: p.violationType,
    amount: p.amount,
    slotId: p.slotId?.toString() ?? null,
    slotCode: p.slotCode,
    zoneId: p.zoneId?.toString() ?? null,
    zoneName: p.zoneName ?? null,
    sessionId: p.sessionId?.toString() ?? null,
    evidenceImageUrl: p.evidenceImageUrl ?? null,
    aiConfidence: p.aiConfidence ?? null,
    note: p.note ?? null,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/**
 * Lấy các vé phạt đang chờ (pending) gắn với một phiên gửi xe.
 * Dùng để cộng tiền phạt vào phí khi khách tra cứu/checkout.
 */
export async function getPendingPenaltiesForSession(sessionId: string): Promise<{
  items: { amount: number; violationType: string; reason: string | null; evidenceImageUrl: string | null }[];
  total: number;
}> {
  const penalties = await Penalty.find({ sessionId, status: "pending" });
  const items = penalties.map((p) => ({
    amount: p.amount,
    violationType: p.violationType,
    reason: p.note ?? null,
    evidenceImageUrl: p.evidenceImageUrl ?? null,
  }));
  return { items, total: items.reduce((sum, i) => sum + i.amount, 0) };
}

// ─── Bảng giá phạt (PenaltyConfig) ──────────────────────────────────────
/** GET /api/penalties/config — danh sách bảng giá phạt. */
export async function listPenaltyConfigs(_request: Request, response: Response) {
  const configs = await PenaltyConfig.find().sort({ violationType: 1 });
  response.json({
    configs: configs.map((c) => ({
      id: c._id.toString(),
      violationType: c.violationType,
      label: c.label,
      amount: c.amount,
      description: c.description ?? null,
      isActive: c.isActive,
    })),
  });
}

/** PUT /api/penalties/config — tạo/cập nhật giá phạt cho một loại vi phạm (upsert). */
export async function upsertPenaltyConfig(request: Request, response: Response) {
  const body = z
    .object({
      violationType: z.enum(VIOLATION_TYPES),
      label: z.string().min(1),
      amount: z.coerce.number().min(0),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    })
    .parse(request.body);

  const config = await PenaltyConfig.findOneAndUpdate(
    { violationType: body.violationType },
    { ...body, updatedBy: request.user?.id },
    { returnDocument: "after", upsert: true },
  );

  response.json({
    config: {
      id: config!._id.toString(),
      violationType: config!.violationType,
      label: config!.label,
      amount: config!.amount,
      description: config!.description ?? null,
      isActive: config!.isActive,
    },
  });
}

// ─── Vé phạt (Penalty) ──────────────────────────────────────────────────
/** GET /api/penalties — danh sách vé phạt, lọc theo status/plate/slotCode. */
export async function listPenalties(request: Request, response: Response) {
  const query = z
    .object({
      status: z.enum(["pending", "paid", "waived", "disputed"]).optional(),
      plate: z.string().optional(),
      slotCode: z.string().optional(),
    })
    .parse(request.query);

  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.plate) filter.plate = query.plate.toUpperCase();
  if (query.slotCode) filter.slotCode = query.slotCode.toUpperCase();

  const penalties = await Penalty.find(filter).sort({ createdAt: -1 }).limit(300);
  response.json({ penalties: penalties.map(serializePenalty) });
}

/**
 * POST /api/penalties — lập vé phạt cho xe đỗ sai tại một ô đỗ.
 * Nếu không truyền `amount`, lấy theo bảng giá phạt của loại vi phạm.
 * Tự điền zone/slotId từ ô đỗ thật; gắn sessionId nếu xe có phiên đang gửi.
 */
export async function createPenalty(request: Request, response: Response) {
  const body = z
    .object({
      plate: z.string().min(1),
      violationType: z.enum(VIOLATION_TYPES),
      slotCode: z.string().min(1),
      amount: z.coerce.number().min(0).optional(),
      evidenceImageUrl: z.string().optional(),
      aiConfidence: z.coerce.number().optional(),
      note: z.string().optional(),
    })
    .parse(request.body);

  const plate = body.plate.toUpperCase();
  const slotCode = body.slotCode.toUpperCase();

  // Tra ô đỗ thật để gắn zone/slotId
  const slot = await ParkingSlot.findOne({ slotCode });
  if (!slot) {
    response.status(404).json({ message: `Không tìm thấy ô đỗ ${slotCode}.` });
    return;
  }

  // Tiền phạt: ưu tiên giá truyền lên, không thì lấy theo bảng giá
  let amount = body.amount;
  if (amount == null) {
    const config = await PenaltyConfig.findOne({ violationType: body.violationType, isActive: true });
    amount = config?.amount ?? 0;
  }

  // Gắn phiên gửi đang hoạt động của xe (nếu có)
  const session = await ParkingSession.findOne({ plate, status: "Đang gửi" }).sort({ checkInAt: -1 });

  const penalty = await Penalty.create({
    plate,
    violationType: body.violationType,
    amount,
    slotId: slot._id,
    slotCode: slot.slotCode,
    zoneId: slot.zoneId,
    zoneName: slot.zoneName,
    sessionId: session?._id,
    evidenceImageUrl: body.evidenceImageUrl,
    aiConfidence: body.aiConfidence,
    note: body.note,
    issuedBy: request.user?.id,
  });

  response.status(201).json({ penalty: serializePenalty(penalty) });
}

/** PATCH /api/penalties/:id — đổi trạng thái vé phạt (đã nộp/miễn/khiếu nại). */
export async function updatePenaltyStatus(request: Request, response: Response) {
  const body = z
    .object({ status: z.enum(["pending", "paid", "waived", "disputed"]), note: z.string().optional() })
    .parse(request.body);

  const update: Record<string, unknown> = {
    status: body.status,
    resolvedBy: request.user?.id,
    resolvedAt: body.status === "pending" ? undefined : new Date(),
  };
  if (body.note !== undefined) update.note = body.note;

  const penalty = await Penalty.findByIdAndUpdate(request.params.id, update, {
    returnDocument: "after",
  });
  if (!penalty) {
    response.status(404).json({ message: "Không tìm thấy vé phạt." });
    return;
  }
  response.json({ penalty: serializePenalty(penalty) });
}

/**
 * POST /api/penalties/:id/pay — tạo link PayOS để thanh toán một vé phạt.
 * Dùng cho thành viên (khách vãng lai cộng phạt vào phí checkout, không qua đây).
 */
export async function payPenalty(request: Request, response: Response) {
  const penalty = await Penalty.findById(request.params.id);
  if (!penalty) {
    response.status(404).json({ message: "Không tìm thấy vé phạt." });
    return;
  }
  if (penalty.status === "paid") {
    response.status(400).json({ message: "Vé phạt đã được thanh toán." });
    return;
  }
  if (penalty.amount <= 0) {
    response.status(400).json({ message: "Vé phạt không có số tiền cần thu." });
    return;
  }

  // Tái dùng giao dịch pending nếu đã tạo trước đó
  const existing = await Transaction.findOne({ penaltyId: penalty._id, status: "pending" });
  if (existing?.payosCheckoutUrl) {
    response.json({
      orderCode: existing.payosOrderCode,
      checkoutUrl: existing.payosCheckoutUrl,
      qrCode: existing.payosQrCode,
      amount: existing.amount,
    });
    return;
  }

  const baseUrl = process.env.API_URL || process.env.BASE_URL || "http://localhost:4000";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const payosResult = await createPayOSPayment({
    amount: penalty.amount,
    sessionId: penalty._id.toString(),
    label: "iPARK FINE",
    baseUrl,
    frontendUrl,
  });

  if (!payosResult.success) {
    response.status(502).json({ message: payosResult.error || "Không tạo được liên kết PayOS." });
    return;
  }

  await Transaction.create({
    penaltyId: penalty._id,
    sessionId: penalty.sessionId,
    method: "payos",
    amount: penalty.amount,
    status: "pending",
    note: `IPARK-FINE-${penalty._id.toString()}`,
    payosOrderCode: String(payosResult.orderCode),
    payosCheckoutUrl: payosResult.checkoutUrl,
    payosQrCode: payosResult.qrCode,
  });

  response.json({
    orderCode: payosResult.orderCode,
    checkoutUrl: payosResult.checkoutUrl,
    qrCode: payosResult.qrCode,
    accountNumber: payosResult.accountNumber,
    accountName: payosResult.accountName,
    bin: payosResult.bin,
    amount: penalty.amount,
  });
}

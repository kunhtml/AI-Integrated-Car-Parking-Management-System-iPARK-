import { z } from "zod";

export const registerRfidSchema = z.object({
  body: z.object({
    cardId: z
      .string()
      .trim()
      .min(4, "Mã thẻ phải có ít nhất 4 ký tự")
      .max(32, "Mã thẻ tối đa 32 ký tự")
      .transform((v) => v.toUpperCase()),
    notes: z.string().trim().max(500).optional(),
  }),
});

export const updateRfidStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Thiếu ID thẻ"),
  }),
  body: z.object({
    status: z.enum(["available", "in-use", "lost", "blocked"]),
    blockedReason: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
});

export const assignRfidSchema = z.object({
  body: z.object({
    cardId: z
      .string()
      .trim()
      .min(1, "Thiếu mã thẻ")
      .transform((v) => v.toUpperCase()),
    sessionId: z.string().min(1, "Thiếu ID phiên gửi xe"),
    gate: z.enum(["entry", "exit"]),
  }),
});

export const scanRfidSchema = z.object({
  body: z.object({
    cardId: z
      .string()
      .trim()
      .min(1, "Thiếu mã thẻ")
      .transform((v) => v.toUpperCase()),
    gate: z.enum(["entry", "exit"]),
    deviceId: z.string().optional(),
    plateDetected: z.string().trim().optional(),
  }),
});

export const returnRfidSchema = z.object({
  body: z.object({
    cardId: z
      .string()
      .trim()
      .min(1, "Thiếu mã thẻ")
      .transform((v) => v.toUpperCase()),
    sessionId: z.string().min(1, "Thiếu ID phiên gửi xe"),
  }),
});

export const listRfidSchema = z.object({
  query: z.object({
    status: z.enum(["available", "in-use", "lost", "blocked"]).optional(),
    search: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const listScanLogsSchema = z.object({
  query: z.object({
    cardId: z.string().trim().optional(),
    action: z
      .enum(["entry", "exit", "assign", "return", "block", "unblock", "report-lost"])
      .optional(),
    status: z.enum(["success", "failed", "blocked", "mismatch"]).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const confirmExitRfidSchema = z.object({
  body: z.object({
    cardId: z
      .string()
      .trim()
      .min(1, "Thiếu mã thẻ")
      .transform((v) => v.toUpperCase()),
    sessionId: z.string().min(1, "Thiếu ID phiên gửi xe"),
    action: z.enum(["confirm", "reject"], {
      message: "Hành động phải là 'confirm' hoặc 'reject'",
    }),
  }),
});

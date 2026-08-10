"use client";

import type { CSSProperties } from "react";

export const sectionStyle: CSSProperties = {
  background: "var(--surface)",
  borderRadius: 16,
  padding: "clamp(16px, 3vw, 24px) clamp(16px, 3vw, 28px)",
  border: "1px solid var(--border, #e2e6ef)",
};

export const sectionHeadingStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 20,
  flexWrap: "wrap",
  gap: 8,
};

export const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "var(--muted)",
};

export const inputStyle: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--border, #e2e6ef)",
  borderRadius: 8,
  fontSize: "0.9rem",
  background: "var(--surface)",
  boxSizing: "border-box",
};

export const DURATION_LABELS: Record<string, string> = {
  monthly: "Tháng",
  quarterly: "Quý",
  yearly: "Năm",
};

export function daysRemaining(endDate: string): number {
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function isVehicleBlocked(status?: string | null): boolean {
  return status === "Blacklist" || status === "Cần duyệt";
}

export function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Hoạt động";
    case "pending_payment":
      return "Chờ thanh toán";
    case "expired":
      return "Hết hạn";
    case "cancelled":
      return "Đã hủy";
    default:
      return "—";
  }
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "badge success";
    case "pending_payment":
      return "badge warning";
    case "expired":
      return "badge warning";
    case "cancelled":
      return "badge";
    default:
      return "badge";
  }
}

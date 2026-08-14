import type { Role } from "@/types";

export const roleLabels: Record<Role, string> = {
  admin: "Quản trị viên",
  staff: "Nhân viên",
  customer: "Khách hàng",
};

export const currency = {
  format: (value: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value),
  formatShort: (value: number) =>
    value >= 1000000
      ? `${(value / 1000000).toFixed(1)}M`
      : value >= 1000
      ? `${(value / 1000).toFixed(0)}K`
      : `${value}`,
};

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/**
 * URL của Python bridge service (smart_parking_rut_gon).
 * Service này chạy độc lập, đọc ảnh từ camera + RFID và đẩy log về backend.
 * Có thể set qua NEXT_PUBLIC_BRIDGE_URL.
 */
export const bridgeBaseUrl: string =
  process.env.NEXT_PUBLIC_BRIDGE_URL || "http://localhost:5050";

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

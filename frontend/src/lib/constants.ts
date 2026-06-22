import type { Role } from "@/types";

export const roleLabels: Record<Role, string> = {
  admin: "Quản trị viên",
  staff: "Nhân viên",
  customer: "Khách hàng",
};

export const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

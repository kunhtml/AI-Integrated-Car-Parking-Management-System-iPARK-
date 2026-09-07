import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nhân viên | iPARK",
  description: "Quản lý danh sách nhân viên của bãi đỗ xe.",
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}

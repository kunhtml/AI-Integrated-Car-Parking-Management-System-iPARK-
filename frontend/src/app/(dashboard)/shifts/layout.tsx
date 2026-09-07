import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ca làm việc | iPARK",
  description: "Quản lý ca làm việc và phân công nhân viên.",
};

export default function ShiftsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

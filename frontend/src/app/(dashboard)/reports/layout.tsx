import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Báo cáo | iPARK",
  description: "Xem và xuất các báo cáo vận hành bãi đỗ xe.",
};

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

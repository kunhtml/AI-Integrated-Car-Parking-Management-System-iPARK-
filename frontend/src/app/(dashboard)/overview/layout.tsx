import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tổng quan | iPARK",
  description: "Tổng quan tình hình vận hành bãi đỗ xe theo thời gian thực.",
};

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Báo cáo doanh thu | iPARK",
  description: "Theo dõi và phân tích doanh thu gửi xe theo thời gian.",
};

export default function RevenueReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

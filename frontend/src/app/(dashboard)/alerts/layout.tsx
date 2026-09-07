import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cảnh báo hệ thống | iPARK",
  description: "Theo dõi và xử lý cảnh báo hệ thống bãi đỗ xe theo thời gian thực.",
};

export default function AlertsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

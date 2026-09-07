import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hóa đơn điện tử | iPARK",
  description: "Tạo và quản lý hóa đơn điện tử cho các phiên đỗ xe.",
};

export default function InvoicesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

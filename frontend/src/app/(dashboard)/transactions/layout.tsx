import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lịch sử giao dịch | iPARK",
  description: "Xem lịch sử giao dịch, thanh toán và nạp ví của bãi đỗ xe.",
};

export default function TransactionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

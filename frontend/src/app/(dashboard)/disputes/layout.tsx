import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Khiếu nại | iPARK",
  description: "Tiếp nhận và xử lý khiếu nại của khách hàng.",
};

export default function DisputesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

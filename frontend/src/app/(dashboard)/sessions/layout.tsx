import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phiên đỗ xe | iPARK",
  description: "Theo dõi và quản lý các phiên đỗ xe tại bãi.",
};

export default function SessionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

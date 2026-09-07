import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phương tiện | iPARK",
  description: "Quản lý phương tiện và tra cứu thông tin xe.",
};

export default function VehiclesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

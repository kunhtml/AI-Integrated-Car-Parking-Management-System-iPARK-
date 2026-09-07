import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phiên đang hoạt động & ngoại lệ | iPARK",
  description: "Theo dõi các phiên đang hoạt động và xử lý ngoại lệ tại bãi.",
};

export default function ParkingSessionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ra bãi xe | iPARK",
  description: "Xác nhận xe ra bãi và thanh toán phí gửi xe nhanh chóng.",
};

export default function GuestExitLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

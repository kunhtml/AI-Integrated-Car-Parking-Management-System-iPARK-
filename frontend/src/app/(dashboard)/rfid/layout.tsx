import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thẻ RFID | iPARK",
  description: "Quản lý thẻ RFID: đăng ký, nạp tiền và khóa/mở thẻ.",
};

export default function RfidLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

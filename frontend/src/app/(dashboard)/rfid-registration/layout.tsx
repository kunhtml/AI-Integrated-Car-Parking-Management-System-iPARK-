import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng ký thẻ RFID | iPARK",
  description: "Đăng ký và gán thẻ RFID cho khách hàng.",
};

export default function RfidRegistrationLayout({ children }: { children: React.ReactNode }) {
  return children;
}

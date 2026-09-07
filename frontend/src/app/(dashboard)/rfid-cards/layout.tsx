import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quản lý thẻ RFID | iPARK",
  description: "Quản lý thẻ RFID, trạng thái và chủ sở hữu.",
};

export default function RfidCardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

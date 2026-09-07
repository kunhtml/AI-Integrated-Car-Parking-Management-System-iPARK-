import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vận hành thẻ RFID | iPARK",
  description: "Thao tác vận hành thẻ RFID: nạp tiền, khóa, kích hoạt.",
};

export default function RfidOperationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

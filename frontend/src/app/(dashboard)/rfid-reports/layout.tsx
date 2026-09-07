import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Báo cáo RFID | iPARK",
  description: "Báo cáo hoạt động thẻ RFID và giao dịch liên quan.",
};

export default function RfidReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nhật ký quét thẻ | iPARK",
  description: "Lịch sử quét thẻ RFID tại các điểm soát vé.",
};

export default function RfidCardsScanLogsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

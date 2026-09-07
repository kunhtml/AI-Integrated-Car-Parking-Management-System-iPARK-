import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thiết bị | iPARK",
  description: "Quản lý thiết bị camera, cảm biến và đầu đọc RFID của bãi xe.",
};

export default function DevicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

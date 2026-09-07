import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quy tắc phí gửi xe | iPARK",
  description: "Quản lý các quy tắc tính phí gửi xe tại bãi.",
};

export default function ParkingFeeRulesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

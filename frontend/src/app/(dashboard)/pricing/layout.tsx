import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cấu hình giá | iPARK",
  description: "Cấu hình giá và biểu phí dịch vụ gửi xe.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cấu hình sức chứa | iPARK",
  description: "Cấu hình sức chứa và giới hạn phương tiện của bãi xe.",
};

export default function CapacityConfigLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sao lưu dữ liệu | iPARK",
  description: "Sao lưu và khôi phục dữ liệu hệ thống.",
};

export default function BackupsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

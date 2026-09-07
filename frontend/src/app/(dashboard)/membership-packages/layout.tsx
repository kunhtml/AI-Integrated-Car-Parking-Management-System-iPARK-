import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gói thành viên | iPARK",
  description: "Quản lý các gói thành viên và ưu đãi của bãi xe.",
};

export default function MembershipPackagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

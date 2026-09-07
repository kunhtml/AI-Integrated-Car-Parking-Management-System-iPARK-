import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hồ sơ cá nhân | iPARK",
  description: "Xem và cập nhật thông tin hồ sơ cá nhân.",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}

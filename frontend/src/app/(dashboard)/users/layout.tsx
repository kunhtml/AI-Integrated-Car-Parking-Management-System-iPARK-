import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Người dùng | iPARK",
  description: "Quản lý tài khoản người dùng hệ thống iPARK.",
};

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return children;
}

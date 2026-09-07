import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đổi mật khẩu | iPARK",
  description: "Thay đổi mật khẩu đăng nhập tài khoản iPARK.",
};

export default function ChangePasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

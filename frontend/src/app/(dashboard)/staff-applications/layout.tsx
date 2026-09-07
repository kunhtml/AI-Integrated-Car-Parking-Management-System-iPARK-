import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đơn ứng tuyển | iPARK",
  description: "Tiếp nhận và xử lý đơn ứng tuyển vị trí nhân viên.",
};

export default function StaffApplicationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

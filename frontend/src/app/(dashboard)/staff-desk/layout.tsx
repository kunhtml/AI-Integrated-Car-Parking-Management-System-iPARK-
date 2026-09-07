import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quầy nhân viên | iPARK",
  description: "Giao diện làm việc của nhân viên tại quầy gửi xe.",
};

export default function StaffDeskLayout({ children }: { children: React.ReactNode }) {
  return children;
}

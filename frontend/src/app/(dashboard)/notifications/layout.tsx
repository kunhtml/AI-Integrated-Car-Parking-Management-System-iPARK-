import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thông báo | iPARK",
  description: "Trung tâm thông báo: theo dõi sự kiện và cảnh báo mới nhất.",
};

export default function NotificationsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

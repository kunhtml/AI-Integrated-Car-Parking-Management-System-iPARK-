import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nhật ký camera | iPARK",
  description: "Theo dõi nhật ký camera tại các cổng vào ra.",
};

export default function CameraLogsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

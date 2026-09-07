import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cameras | iPARK",
  description: "Quản lý camera nhận diện biển số tại các cổng vào ra.",
};

export default function CamerasLayout({ children }: { children: React.ReactNode }) {
  return children;
}

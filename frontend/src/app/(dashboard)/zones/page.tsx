import type { Metadata } from "next";
import { ZonesView } from "@/features/zones/zones-view";

export const metadata: Metadata = {
  title: "Quản lý khu vực | iPARK",
  description: "Quản lý các khu vực đỗ xe, vị trí và sức chứa của bãi xe.",
};

export default function ZonesPage() {
  return <ZonesView />;
}

import type { Metadata } from "next";
import { ParkingSlotsView } from "@/features/parking-slots/parking-slots-view";

export const metadata: Metadata = {
  title: "Quản lý chỗ đỗ xe | iPARK",
  description: "Theo dõi trạng thái, sức chứa và phân loại các vị trí đỗ xe.",
};

export default function ParkingSlotsPage() {
  return <ParkingSlotsView />;
}

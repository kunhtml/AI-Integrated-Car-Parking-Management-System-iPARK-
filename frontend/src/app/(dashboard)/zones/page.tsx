import type { Metadata } from "next";

import { RoleGuard } from "@/components/layout/role-guard";
import { ZonesView } from "@/features/zones/zones-view";

export const metadata: Metadata = {
  title: "Quản lý khu vực | iPARK",
  description: "Quản lý các khu vực đỗ xe, vị trí và sức chứa của bãi xe.",
};

export default function ZonesPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager", "staff"]}>
      <ZonesView />
    </RoleGuard>
  );
}

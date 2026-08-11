"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { StaffDeskView } from "@/features/staff-desk/staff-desk-view";

export default function StaffDeskPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff"]}>
      <StaffDeskView />
    </RoleGuard>
  );
}

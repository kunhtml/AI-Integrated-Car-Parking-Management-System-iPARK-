"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { StaffApplicationsView } from "@/features/staff-applications/staff-applications-view";

export default function StaffApplicationsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <StaffApplicationsView />
    </RoleGuard>
  );
}

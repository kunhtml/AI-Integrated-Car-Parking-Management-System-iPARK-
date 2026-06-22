"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { StaffAccountsView } from "@/features/staff/staff-accounts-view";

export default function StaffPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <StaffAccountsView />
    </RoleGuard>
  );
}

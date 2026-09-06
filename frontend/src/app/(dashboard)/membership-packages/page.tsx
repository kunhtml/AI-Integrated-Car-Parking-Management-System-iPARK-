"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { MembershipPackagesView } from "@/features/membership-packages/membership-packages-view";

export default function MembershipPackagesPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager", "staff"]}>
      <MembershipPackagesView />
    </RoleGuard>
  );
}

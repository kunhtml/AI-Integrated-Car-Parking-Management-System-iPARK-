"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { UsersView } from "@/features/users/users-view";

export default function StaffPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager"]}>
      <UsersView />
    </RoleGuard>
  );
}

"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { UsersView } from "@/features/users/users-view";

export default function UsersPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <UsersView />
    </RoleGuard>
  );
}

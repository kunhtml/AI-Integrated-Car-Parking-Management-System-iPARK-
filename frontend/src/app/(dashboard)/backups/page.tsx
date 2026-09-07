"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { BackupsView } from "@/features/backups/backups-view";

export default function BackupsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager"]}>
      <BackupsView />
    </RoleGuard>
  );
}

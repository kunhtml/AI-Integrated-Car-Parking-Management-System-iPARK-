"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { AlertsView } from "@/features/alerts/alerts-view";

export default function AlertsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager"]}>
      <AlertsView />
    </RoleGuard>
  );
}

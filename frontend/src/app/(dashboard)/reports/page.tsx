"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { ReportsView } from "@/features/reports/reports-view";

export default function ReportsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <ReportsView />
    </RoleGuard>
  );
}

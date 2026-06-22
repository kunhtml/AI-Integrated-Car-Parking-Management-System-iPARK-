"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { RevenueReportsView } from "@/features/revenue-reports/revenue-reports-view";

export default function RevenueReportsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff"]}>
      <RevenueReportsView />
    </RoleGuard>
  );
}

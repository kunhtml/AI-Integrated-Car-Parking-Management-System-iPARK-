"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { OverviewView } from "@/features/overview/overview-view";

export default function OverviewPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff"]}>
      <OverviewView />
    </RoleGuard>
  );
}

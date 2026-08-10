"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { IncidentsView } from "@/features/incidents/incidents-view";

export default function IncidentsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff"]}>
      <IncidentsView />
    </RoleGuard>
  );
}

"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { DisputesView } from "@/features/disputes/disputes-view";

export default function DisputesPage() {
  return (
    <RoleGuard allowedRoles={["customer"]}>
      <DisputesView />
    </RoleGuard>
  );
}

"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { RfidReportsView } from "@/features/rfid-reports/rfid-reports-view";

export default function RfidReportsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager"]}>
      <RfidReportsView />
    </RoleGuard>
  );
}

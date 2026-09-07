"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { InvoicesView } from "@/features/invoices/invoices-view";

export default function InvoicesPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager"]}>
      <InvoicesView />
    </RoleGuard>
  );
}

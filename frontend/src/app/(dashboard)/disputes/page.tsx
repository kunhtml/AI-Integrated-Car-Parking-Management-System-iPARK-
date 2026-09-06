"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { useParkingApp } from "@/context/parking-app-context";
import { AdminDisputesView } from "@/features/disputes/admin-disputes-view";
import { DisputesView } from "@/features/disputes/disputes-view";

export default function DisputesPage() {
  const { currentUser } = useParkingApp();
  const isStaffRole =
    currentUser?.role === "admin" || currentUser?.role === "staff";

  return (
    <RoleGuard allowedRoles={["customer", "admin", "manager", "staff"]}>
      {isStaffRole ? <AdminDisputesView /> : <DisputesView />}
    </RoleGuard>
  );
}

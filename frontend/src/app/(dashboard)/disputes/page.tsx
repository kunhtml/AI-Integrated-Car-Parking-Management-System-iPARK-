"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { AdminDisputesView } from "@/features/disputes/admin-disputes-view";
import { DisputesView } from "@/features/disputes/disputes-view";
import { useParkingApp } from "@/context/parking-app-context";

function DisputesPageContent() {
  const { currentUser } = useParkingApp();
  if (currentUser?.role === "admin" || currentUser?.role === "staff") {
    return <AdminDisputesView />;
  }
  return <DisputesView />;
}

export default function DisputesPage() {
  return (
    <RoleGuard allowedRoles={["customer", "admin", "staff"]}>
      <DisputesPageContent />
    </RoleGuard>
  );
}

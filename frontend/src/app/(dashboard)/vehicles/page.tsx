"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { VehiclesView } from "@/features/vehicles/vehicles-view";

export default function VehiclesPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff", "customer"]}>
      <VehiclesView />
    </RoleGuard>
  );
}

"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { ParkingFeeRulesView } from "@/features/parking-fees/parking-fee-rules-view";

export default function ParkingFeeRulesPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <ParkingFeeRulesView />
    </RoleGuard>
  );
}

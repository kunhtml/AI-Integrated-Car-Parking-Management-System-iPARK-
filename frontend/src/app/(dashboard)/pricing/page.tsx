"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { PricingView } from "@/features/pricing/pricing-view";

export default function PricingPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <PricingView />
    </RoleGuard>
  );
}

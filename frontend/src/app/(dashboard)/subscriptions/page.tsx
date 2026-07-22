"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { SubscriptionsView } from "@/features/subscriptions/subscriptions-view";

export default function SubscriptionsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff", "customer"]}>
      <SubscriptionsView />
    </RoleGuard>
  );
}

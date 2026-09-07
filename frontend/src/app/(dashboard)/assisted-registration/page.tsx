"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { AssistedRegistrationView } from "@/features/assisted-registration/assisted-registration-view";

export default function AssistedRegistrationPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager"]}>
      <AssistedRegistrationView />
    </RoleGuard>
  );
}

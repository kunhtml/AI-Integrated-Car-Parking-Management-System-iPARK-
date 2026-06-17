"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { ChangePasswordView } from "@/features/auth/change-password-view";

export default function ChangePasswordPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff", "customer"]}>
      <ChangePasswordView />
    </RoleGuard>
  );
}

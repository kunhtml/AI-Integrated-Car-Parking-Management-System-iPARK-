"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { DevicesView } from "@/features/devices/devices-view";

export default function DevicesPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <DevicesView />
    </RoleGuard>
  );
}

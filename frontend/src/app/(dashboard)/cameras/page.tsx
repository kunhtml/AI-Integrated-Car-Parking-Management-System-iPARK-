"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { CamerasView } from "@/features/cameras/cameras-view";

export default function CamerasPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff"]}>
      <CamerasView />
    </RoleGuard>
  );
}
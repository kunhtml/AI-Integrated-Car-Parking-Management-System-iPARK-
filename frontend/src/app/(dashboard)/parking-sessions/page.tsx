"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { ParkingSessionsView } from "@/features/parking-sessions/parking-sessions-view";

export default function ParkingSessionsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "manager"]}>
      <ParkingSessionsView />
    </RoleGuard>
  );
}
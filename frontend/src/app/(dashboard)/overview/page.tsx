"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { OverviewView } from "@/features/overview/overview-view";
import ParkingProvider from "@/context/parking-app-context";

export default function OverviewPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff"]}>
      <ParkingProvider>
        <OverviewView />
      </ParkingProvider>
    </RoleGuard>
  );
}
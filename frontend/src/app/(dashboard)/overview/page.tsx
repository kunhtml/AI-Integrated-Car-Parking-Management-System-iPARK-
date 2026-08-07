"use client";

import { RoleGuard } from "@/components/layout/role-guard";
import { OverviewView } from "@/features/overview/overview-view";
import { StaffDashboardView } from "@/features/staff/staff-dashboard-view";
import { useParkingApp } from "@/context/parking-app-context";

function OverviewContent() {
  const { currentUser } = useParkingApp();

  if (currentUser?.role === "staff") {
    return <StaffDashboardView />;
  }

  return <OverviewView />;
}

export default function OverviewPage() {
  return (
    <RoleGuard allowedRoles={["admin", "staff"]}>
      <OverviewContent />
    </RoleGuard>
  );
}

"use client";

import { OverviewView } from "@/features/overview/overview-view";
import { StaffDashboardView } from "@/features/staff/staff-dashboard-view";
import { useParkingApp } from "@/context/parking-app-context";

export default function OverviewPage() {
  const { currentUser } = useParkingApp();

  if (currentUser?.role === "staff") {
    return <StaffDashboardView />;
  }

  return <OverviewView />;
}

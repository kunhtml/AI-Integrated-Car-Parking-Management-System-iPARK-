"use client";

import { Dashboard } from "@/components/ui/dashboard";
import { useParkingApp } from "@/context/parking-app-context";

export function OverviewView() {
  const { stats } = useParkingApp();

  return (
    <Dashboard
      active={stats.active}
      available={stats.available}
      completion={stats.completion}
      revenue={stats.revenue}
    />
  );
}

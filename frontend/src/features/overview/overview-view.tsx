"use client";

import { useEffect, useState } from "react";

import { Dashboard } from "@/components/ui/dashboard";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";

type OverviewStats = {
  active: number;
  available: number;
  revenue: number;
  completion: number;
  hourlyPerformance?: [string, number][];
};

export function OverviewView() {
  const { stats: contextStats } = useParkingApp();
  const [stats, setStats] = useState<OverviewStats>(contextStats);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      setLoading(true);
      try {
        const response = await apiFetch("/dashboard/overview");
        const data = await response.json().catch(() => ({}));
        if (mounted && response.ok && data.overview) {
          setStats({
            active: data.overview.active ?? 0,
            available: data.overview.available ?? 30,
            revenue: data.overview.revenue ?? 0,
            completion: data.overview.completion ?? 0,
            hourlyPerformance: data.overview.hourlyPerformance || [
              ["06:00", 25],
              ["08:00", 65],
              ["10:00", 50],
              ["12:00", 45],
              ["14:00", 60],
              ["16:00", 75],
            ],
          });
        }
      } catch {
        if (mounted) {
          setStats(contextStats);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadOverview();
    return () => {
      mounted = false;
    };
  }, [contextStats]);

  return (
    <Dashboard
      active={stats.active}
      available={stats.available}
      completion={stats.completion}
      hourlyPerformance={stats.hourlyPerformance}
      loading={loading}
      revenue={stats.revenue}
    />
  );
}

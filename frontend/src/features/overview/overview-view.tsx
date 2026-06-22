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
};

export function OverviewView() {
  const { stats: contextStats } = useParkingApp();
  const [stats, setStats] = useState<OverviewStats>(contextStats);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStats(contextStats);
  }, [contextStats]);

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      setLoading(true);
      try {
        const response = await apiFetch("/dashboard/overview");
        const data = await response.json().catch(() => ({}));
        if (mounted && response.ok && data.overview) {
          setStats({
            active: data.overview.active ?? contextStats.active,
            available: data.overview.available ?? contextStats.available,
            revenue: data.overview.revenue ?? contextStats.revenue,
            completion: data.overview.completion ?? contextStats.completion,
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
  }, [contextStats.active, contextStats.available, contextStats.completion, contextStats.revenue]);

  return (
    <Dashboard
      active={stats.active}
      available={stats.available}
      completion={stats.completion}
      loading={loading}
      revenue={stats.revenue}
    />
  );
}

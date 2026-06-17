"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "@/components/ui/dashboard";
import { apiFetch } from "@/lib/api";

type OverviewStats = {
  active: number;
  available: number;
  revenue: number;
  completion: number;
};

const emptyStats: OverviewStats = {
  active: 0,
  available: 0,
  revenue: 0,
  completion: 0,
};

export function OverviewView() {
  const [stats, setStats] = useState<OverviewStats>(emptyStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      try {
        const response = await apiFetch("/dashboard/overview");
        const data = await response.json().catch(() => ({}));
        if (mounted && response.ok) {
          setStats({ ...emptyStats, ...(data.overview || {}) });
        }
      } catch {
        if (mounted) setStats(emptyStats);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOverview();
    return () => {
      mounted = false;
    };
  }, []);

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

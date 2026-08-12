"use client";

import { useEffect, useRef, useCallback } from "react";

import { apiFetch } from "@/lib/client-api";
import type { ParkingSession, ParkingSlot, Zone } from "@/types";

type DashboardPollingParams = {
  enabled: boolean;
  intervalMs?: number;
  onSessionsUpdate: (sessions: ParkingSession[]) => void;
  onZonesUpdate: (zones: Zone[]) => void;
  onSlotsUpdate: (slots: ParkingSlot[]) => void;
  onStatsUpdate?: (stats: { active: number; available: number; revenue: number; completion: number }) => void;
};

/**
 * Hook để poll dữ liệu dashboard định kỳ (real-time updates).
 * Dùng cho admin dashboard để tự động cập nhật sessions, zones, slots, stats.
 */
export function useDashboardPolling({
  enabled,
  intervalMs = 30_000, // 30 giây mặc định
  onSessionsUpdate,
  onZonesUpdate,
  onSlotsUpdate,
  onStatsUpdate,
}: DashboardPollingParams) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const onSessionsUpdateRef = useRef(onSessionsUpdate);
  onSessionsUpdateRef.current = onSessionsUpdate;

  const onZonesUpdateRef = useRef(onZonesUpdate);
  onZonesUpdateRef.current = onZonesUpdate;

  const onSlotsUpdateRef = useRef(onSlotsUpdate);
  onSlotsUpdateRef.current = onSlotsUpdate;

  const onStatsUpdateRef = useRef(onStatsUpdate);
  onStatsUpdateRef.current = onStatsUpdate;

  const fetchUpdates = useCallback(async () => {
    if (!enabledRef.current) return;

    try {
      // Fetch sessions, zones, slots, and stats in parallel
      const [sessionsRes, zonesRes, slotsRes, statsRes] = await Promise.allSettled([
        apiFetch("/parking-sessions"),
        apiFetch("/zones"),
        apiFetch("/parking-slots"),
        apiFetch("/dashboard/overview"),
      ]);

      // Update sessions
      if (sessionsRes.status === "fulfilled" && sessionsRes.value.ok) {
        const data = await sessionsRes.value.json();
        onSessionsUpdateRef.current(data.sessions ?? []);
      }

      // Update zones
      if (zonesRes.status === "fulfilled" && zonesRes.value.ok) {
        const data = await zonesRes.value.json();
        onZonesUpdateRef.current(data.zones ?? []);
      }

      // Update slots
      if (slotsRes.status === "fulfilled" && slotsRes.value.ok) {
        const data = await slotsRes.value.json();
        onSlotsUpdateRef.current(data.slots ?? []);
      }

      // Update stats if callback provided
      if (onStatsUpdateRef.current && statsRes.status === "fulfilled" && statsRes.value.ok) {
        const data = await statsRes.value.json();
        const overview = data.overview;
        if (overview) {
          onStatsUpdateRef.current({
            active: overview.active ?? 0,
            available: overview.available ?? 0,
            revenue: overview.revenue ?? 0,
            completion: overview.completion ?? 0,
          });
        }
      }
    } catch (error) {
      console.error("[use-dashboard-polling] Poll error:", error);
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Fetch immediately on mount
    fetchUpdates();

    // Set up polling interval
    const intervalId = setInterval(fetchUpdates, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, intervalMs, fetchUpdates]);
}

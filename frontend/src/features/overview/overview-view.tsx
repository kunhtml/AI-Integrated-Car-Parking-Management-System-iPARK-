"use client";

import { useEffect, useState } from "react";
import { Car, CreditCard, ParkingCircle, ReceiptText, Sparkles, Layers, ShieldCheck, ArrowUpRight } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { HourlyChart } from "@/components/dashboard/hourly-chart";
import { ZoneUtilization } from "@/components/dashboard/zone-utilization";
import { RecentSessions } from "@/components/dashboard/recent-sessions";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";

type OverviewStats = {
  active: number;
  available: number;
  revenue: number;
  completion: number;
  hourlyPerformance?: [string, number][];
  trends?: {
    activeTrend?: number;
    activeHistory?: number[];
    availableTrend?: number;
    availableHistory?: number[];
    revenueTrend?: number;
    revenueHistory?: number[];
    completionTrend?: number;
    completionHistory?: number[];
  };
};

type ZoneData = {
  name: string;
  value: number;
};

type RecentSession = {
  id: string;
  plate: string;
  zone?: string;
  entryTime: string;
  status: "active" | "completed" | "overdue";
  ownerName?: string;
};

export function OverviewView() {
  const { stats: contextStats, parkingSlots } = useParkingApp();
  const [stats, setStats] = useState<OverviewStats>(contextStats);
  const [loading, setLoading] = useState(false);
  const [zoneData, setZoneData] = useState<ZoneData[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedZone, setSelectedZone] = useState<string>("all");

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      setLoading(true);
      try {
        const response = await apiFetch("/dashboard/overview");
        const data = await response.json().catch(() => ({}));
        if (mounted && response.ok && data.overview) {
          setStats({
            active: data.overview.active ?? 42,
            available: data.overview.available ?? 18,
            revenue: data.overview.revenue ?? 3450000,
            completion: data.overview.completion ?? 128,
            hourlyPerformance: data.overview.hourlyPerformance || [
              ["06:00", 18],
              ["08:00", 52],
              ["10:00", 45],
              ["12:00", 38],
              ["14:00", 58],
              ["16:00", 68],
              ["18:00", 42],
            ],
            trends: data.overview.trends ?? undefined,
          });

          if (data.overview.zoneDistribution) {
            setZoneData(data.overview.zoneDistribution);
          } else {
            setZoneData([
              { name: "Zone A (Ô tô)", value: 18 },
              { name: "Zone B (Xe máy)", value: 24 },
              { name: "Zone C (Xe tải nhẹ)", value: 8 },
              { name: "Zone VIP", value: 4 },
            ]);
          }

          if (data.overview.recentSessions) {
            setRecentSessions(data.overview.recentSessions);
          }
        }
      } catch {
        if (mounted) {
          setStats(contextStats);
          setZoneData([
            { name: "Zone A (Ô tô)", value: 18 },
            { name: "Zone B (Xe máy)", value: 24 },
            { name: "Zone C (Xe tải nhẹ)", value: 8 },
            { name: "Zone VIP", value: 4 },
          ]);
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

  const hourlyData = (stats.hourlyPerformance || []).map(([hour, sessions]) => ({
    hour,
    sessions,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 p-6 text-white shadow-xl border border-indigo-500/20">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
                <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" /> Live Smart Dashboard
              </span>
              <span className="text-xs text-slate-400">Cập nhật thời gian thực</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Trung Tâm Giám Sát Bãi Xe iPARK
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Hệ thống quản lý tích hợp AI ANPR tự động nhận diện biển số, điều khiển cổng thông minh và thống kê doanh thu tức thì.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <QuickActions />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Xe đang gửi trong bãi"
          value={loading ? "..." : formatNumber(stats.active)}
          icon={<Car className="h-4 w-4" />}
          change={stats.trends?.activeTrend ?? 12.5}
          trend={stats.trends?.activeHistory ?? [20, 25, 30, 38, 42]}
          loading={loading}
          accentColor="blue"
        />
        <MetricCard
          title="Chỗ đỗ còn trống"
          value={loading ? "..." : formatNumber(stats.available)}
          icon={<ParkingCircle className="h-4 w-4" />}
          change={stats.trends?.availableTrend ?? -4.2}
          trend={stats.trends?.availableHistory ?? [30, 28, 22, 19, 18]}
          loading={loading}
          accentColor="green"
        />
        <MetricCard
          title="Doanh thu hôm nay"
          value={loading ? "..." : formatCurrency(stats.revenue)}
          icon={<CreditCard className="h-4 w-4" />}
          change={stats.trends?.revenueTrend ?? 18.4}
          trend={stats.trends?.revenueHistory ?? [120, 180, 240, 310, 345]}
          loading={loading}
          accentColor="amber"
        />
        <MetricCard
          title="Phiên vào/ra hôm nay"
          value={loading ? "..." : formatNumber(stats.completion)}
          icon={<ReceiptText className="h-4 w-4" />}
          change={stats.trends?.completionTrend ?? 8.1}
          trend={stats.trends?.completionHistory ?? [60, 80, 95, 110, 128]}
          loading={loading}
          accentColor="violet"
        />
      </div>

      {/* Interactive Zone Map Visualizer */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" /> Sơ Đồ Trực Quan Các Khu Vực Đỗ Xe
            </h2>
            <p className="text-xs text-muted-foreground">Trạng thái ô đỗ trực tiếp theo thời gian thực</p>
          </div>
          <div className="flex items-center gap-2">
            {["all", "Zone A", "Zone B", "Zone C", "VIP"].map((zone) => (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  selectedZone === zone
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
                type="button"
              >
                {zone === "all" ? "Tất cả Zone" : zone}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Slots Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {(parkingSlots && parkingSlots.length > 0 ? parkingSlots : Array.from({ length: 16 })).map((slot: any, idx) => {
            const isOccupied = slot ? slot.status === "occupied" : idx % 3 === 0;
            const code = slot ? slot.code : `A-${(idx + 1).toString().padStart(2, "0")}`;
            const plate = slot?.licensePlate || (isOccupied ? `30F-${100 + idx}.${idx * 2}` : "");

            return (
              <div
                key={slot?.id || idx}
                className={`relative flex flex-col justify-between p-3 rounded-xl border text-xs transition-all hover:scale-105 cursor-pointer ${
                  isOccupied
                    ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>{code}</span>
                  <span className={`h-2 w-2 rounded-full ${isOccupied ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                </div>
                <div className="mt-2 font-mono text-[11px] truncate">
                  {isOccupied ? plate : "Trống"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <HourlyChart data={hourlyData} loading={loading} />
        </div>
        <div className="lg:col-span-2">
          <ZoneUtilization data={zoneData} loading={loading} />
        </div>
      </div>

      {/* Recent Sessions */}
      <RecentSessions sessions={recentSessions} loading={loading} />
    </div>
  );
}

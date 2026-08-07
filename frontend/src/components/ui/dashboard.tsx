"use client";

import { Car, CreditCard, ParkingCircle, ReceiptText } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { formatCurrency, formatNumber } from "@/lib/utils";

const defaultHourlyPerformance: [string, number][] = [
  ["06:00", 25],
  ["08:00", 65],
  ["10:00", 50],
  ["12:00", 45],
  ["14:00", 60],
  ["16:00", 75],
];

interface DashboardProps {
  active: number;
  available: number;
  completion: number;
  revenue: number;
  hourlyPerformance?: [string, number][];
  reportsOnly?: boolean;
  loading?: boolean;
  /** Trend data from backend (optional — falls back to no sparkline) */
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
}

export function Dashboard({
  active,
  available,
  completion,
  revenue,
  hourlyPerformance = defaultHourlyPerformance,
  reportsOnly = false,
  loading = false,
  trends,
}: DashboardProps) {
  const chartData = (hourlyPerformance.length > 0
    ? hourlyPerformance
    : defaultHourlyPerformance
  ).map(([hour, sessions]) => ({ hour, sessions }));

  return (
    <section className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Xe đang gửi"
          value={loading ? "..." : formatNumber(active)}
          icon={<Car className="h-4 w-4" />}
          change={trends?.activeTrend}
          trend={trends?.activeHistory}
          loading={loading}
        />
        <MetricCard
          title="Chỗ còn trống"
          value={loading ? "..." : formatNumber(available)}
          icon={<ParkingCircle className="h-4 w-4" />}
          change={trends?.availableTrend}
          trend={trends?.availableHistory}
          loading={loading}
        />
        <MetricCard
          title="Doanh thu hôm nay"
          value={loading ? "..." : formatCurrency(revenue)}
          icon={<CreditCard className="h-4 w-4" />}
          change={trends?.revenueTrend}
          trend={trends?.revenueHistory}
          loading={loading}
        />
        <MetricCard
          title="Phiên đã hoàn thành"
          value={loading ? "..." : formatNumber(completion)}
          icon={<ReceiptText className="h-4 w-4" />}
          change={trends?.completionTrend}
          trend={trends?.completionHistory}
          loading={loading}
        />
      </div>

      {/* Hourly Performance Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <p className="text-xs text-muted-foreground font-medium">
              {reportsOnly ? "Báo cáo" : "Tổng quan"}
            </p>
            <CardTitle className="text-lg mt-0.5">
              Hiệu suất bãi xe trong ngày
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.1 }}
              />
              <Bar
                dataKey="sessions"
                name="Phiên gửi xe"
                fill="url(#barGradient)"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </section>
  );
}

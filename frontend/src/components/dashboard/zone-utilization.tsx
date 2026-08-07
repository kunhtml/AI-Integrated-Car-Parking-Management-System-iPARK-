"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/ui/loading-skeleton";

interface ZoneDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface ZoneUtilizationProps {
  data: ZoneDataPoint[];
  loading?: boolean;
  title?: string;
}

const DEFAULT_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{name}</p>
      <p className="text-sm font-bold">
        {value} xe ({(percent * 100).toFixed(1)}%)
      </p>
    </div>
  );
}

export function ZoneUtilization({
  data,
  loading = false,
  title = "Phân bố theo khu vực",
}: ZoneUtilizationProps) {
  if (loading) return <ChartSkeleton height={250} />;

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-12">
            Không có dữ liệu khu vực.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Add colors to data if not provided
  const chartData = data.map((d, i) => ({
    ...d,
    color: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    percent: 0, // will be computed by recharts
  }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center gap-6">
          {/* Donut Chart */}
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-col gap-2 flex-1">
            {chartData.map((entry, index) => {
              const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
              return (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-muted-foreground truncate">{entry.name}</span>
                  <span className="ml-auto font-medium tabular-nums">
                    {entry.value} <span className="text-muted-foreground text-xs">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

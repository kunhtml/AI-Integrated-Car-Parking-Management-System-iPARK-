"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatChange } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: number[];
  loading?: boolean;
  className?: string;
  /** Accent color for the icon badge */
  accentColor?: "blue" | "green" | "amber" | "red" | "violet";
}

const accentStyles = {
  blue: "from-blue-500 to-blue-600 shadow-blue-500/20",
  green: "from-emerald-500 to-emerald-600 shadow-emerald-500/20",
  amber: "from-amber-500 to-amber-600 shadow-amber-500/20",
  red: "from-red-500 to-red-600 shadow-red-500/20",
  violet: "from-violet-500 to-violet-600 shadow-violet-500/20",
};

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const chartData = data.map((value, index) => ({ index, value }));
  const color = positive ? "#10b981" : "#ef4444";

  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${positive}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${positive})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MetricCardSkeleton() {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
        <Skeleton className="h-7 w-16 mb-2" />
        <Skeleton className="h-3 w-28 mb-3" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel = "so với hôm qua",
  icon,
  trend,
  loading = false,
  className,
  accentColor = "blue",
}: MetricCardProps) {
  if (loading) return <MetricCardSkeleton />;

  const positive = (change ?? 0) >= 0;
  const hasChange = change !== undefined && change !== null;
  const hasTrend = trend && trend.length > 0;

  return (
    <Card className={cn(
      "border-0 shadow-sm hover:shadow-md transition-shadow duration-200",
      "bg-card/80 backdrop-blur-sm",
      className
    )}>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-medium text-muted-foreground">
            {title}
          </span>
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg",
            accentStyles[accentColor]
          )}>
            {icon}
          </div>
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-bold tracking-tight text-foreground">
            {value}
          </span>
          {hasChange && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                positive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              )}
            >
              {positive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatChange(change)}
            </span>
          )}
        </div>

        {/* Label */}
        <p className="text-[12px] text-muted-foreground/70 mt-1">
          {changeLabel}
        </p>

        {/* Sparkline */}
        {hasTrend && (
          <div className="mt-3 -mx-1">
            <Sparkline data={trend} positive={positive} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

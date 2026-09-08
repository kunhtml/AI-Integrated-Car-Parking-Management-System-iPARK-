"use client";

import { Flame } from "lucide-react";
import type { PeakHourPoint } from "@/types";

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function getIntensity(count: number, max: number): string {
  if (max === 0) return "hsl(210, 10%, 95%)";
  const ratio = count / max;
  if (ratio > 0.75) return "hsl(0, 70%, 50%)";
  if (ratio > 0.5) return "hsl(30, 80%, 55%)";
  if (ratio > 0.25) return "hsl(45, 80%, 65%)";
  if (ratio > 0) return "hsl(120, 40%, 80%)";
  return "hsl(210, 10%, 95%)";
}

export function PeakHoursHeatmap({ data }: { data: PeakHourPoint[] }) {
  if (!data.length) {
    return <p className="muted-cell">Nhấn "Tải dữ liệu" để xem heatmap giờ cao điểm.</p>;
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  // Build 7x24 grid (dayOfWeek 1-7 from MongoDB $dayOfWeek: 1=Sunday)
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const point of data) {
    const dayIndex = point.dayOfWeek - 1; // 0=Sunday
    grid[dayIndex][point.hour] = point.count;
  }

  return (
    <div>
      <div className="panel-heading">
        <div><p>Giờ cao điểm</p><h2>Heatmap (ngày × giờ)</h2></div>
        <Flame size={20} />
      </div>
      <div className="heatmap-container">
        <div className="heatmap-header">
          <div className="heatmap-label" />
          {Array.from({ length: 24 }, (_, h) => (
            <div className="heatmap-hour-label" key={h}>{h}</div>
          ))}
        </div>
        {grid.map((row, dayIndex) => (
          <div className="heatmap-row" key={dayIndex}>
            <div className="heatmap-label">{DAY_LABELS[dayIndex]}</div>
            {row.map((count, hour) => (
              <div
                className="heatmap-cell"
                key={hour}
                style={{ background: getIntensity(count, max) }}
                title={`${DAY_LABELS[dayIndex]} ${hour}h: ${count} xe`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Ít</span>
        <div style={{ background: "hsl(120, 40%, 80%)", width: 20, height: 14, borderRadius: 2 }} />
        <div style={{ background: "hsl(45, 80%, 65%)", width: 20, height: 14, borderRadius: 2 }} />
        <div style={{ background: "hsl(30, 80%, 55%)", width: 20, height: 14, borderRadius: 2 }} />
        <div style={{ background: "hsl(0, 70%, 50%)", width: 20, height: 14, borderRadius: 2 }} />
        <span>Nhiều</span>
      </div>
    </div>
  );
}

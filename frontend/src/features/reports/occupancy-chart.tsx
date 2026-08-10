"use client";

import { Clock } from "lucide-react";
import type { OccupancyHourPoint } from "@/types";

export function OccupancyChart({ data }: { data: OccupancyHourPoint[] }) {
  if (!data.length) {
    return <p className="muted-cell">Nhấn "Tải dữ liệu" để xem biểu đồ lấp đầy.</p>;
  }

  const maxOccupancy = Math.max(...data.map((d) => d.maxOccupancy), 1);

  return (
    <div>
      <div className="panel-heading">
        <div><p>Lấp đầy</p><h2>Tỷ lệ lấp đầy theo giờ (0-23h)</h2></div>
        <Clock size={20} />
      </div>
      <div className="chart-bars">
        {data.map((point) => (
          <div className="bar-item" key={point.hour}>
            <div style={{ height: `${(point.avgOccupancy / maxOccupancy) * 100}%` }} title={`Avg: ${point.avgOccupancy}`} />
            <span>{String(point.hour).padStart(2, "0")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { TrendingUp } from "lucide-react";
import { currency } from "@/lib/constants";
import type { RevenueChartPoint } from "@/types";

export function RevenueChart({ data }: { data: RevenueChartPoint[] }) {
  if (!data.length) {
    return <p className="muted-cell">Nhấn "Tải dữ liệu" để xem biểu đồ doanh thu.</p>;
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div>
      <div className="panel-heading">
        <div><p>Biểu đồ</p><h2>Doanh thu theo thời gian</h2></div>
        <TrendingUp size={20} />
      </div>
      <div className="chart-bars">
        {data.map((point) => (
          <div className="bar-item" key={point.date}>
            <div style={{ height: `${(point.revenue / maxRevenue) * 100}%` }} title={currency.format(point.revenue)} />
            <span>{point.date.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>Ngày</th><th>Doanh thu</th><th>Số GD</th></tr></thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.date}>
                <td>{point.date}</td>
                <td><strong>{currency.format(point.revenue)}</strong></td>
                <td>{point.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

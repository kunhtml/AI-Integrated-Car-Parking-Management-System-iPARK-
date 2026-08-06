import React from "react";
import { RevenueChartPoint } from "@/types";
import { currency } from "@/lib/constants";

export function RevenueChart({ data }: { data: RevenueChartPoint[] }) {
  if (!data || data.length === 0) {
    return <p className="muted-cell text-slate-500 text-sm">Chưa có dữ liệu doanh thu cho khoảng thời gian này.</p>;
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mt-4">
      <h3 className="text-sm font-bold text-slate-900 mb-6">Biểu đồ doanh thu</h3>
      <div className="flex h-64 items-end gap-3 pt-6 border-b border-l border-slate-100 px-4">
        {data.map((d, index) => {
          const heightPercent = (d.revenue / maxRevenue) * 100;
          return (
            <div className="flex-1 flex flex-col items-center group relative h-full justify-end" key={index}>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] rounded py-1 px-2 pointer-events-none z-10 whitespace-nowrap">
                <span>{currency.format(d.revenue)}</span>
                {d.sessions !== undefined && <span className="text-slate-400">{d.sessions} lượt</span>}
              </div>
              {/* Bar */}
              <div
                className="w-full bg-blue-600 rounded-t transition-all duration-300 hover:bg-blue-700"
                style={{ height: `${Math.max(heightPercent, 2)}%` }}
              />
              {/* Label */}
              <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

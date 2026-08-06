import React from "react";
import { OccupancyHourPoint } from "@/types";

export function OccupancyChart({ data }: { data: OccupancyHourPoint[] }) {
  if (!data || data.length === 0) {
    return <p className="muted-cell text-slate-500 text-sm">Chưa có dữ liệu lấp đầy cho khoảng thời gian này.</p>;
  }

  const maxOccupied = Math.max(...data.map((d) => d.occupied), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mt-4">
      <h3 className="text-sm font-bold text-slate-900 mb-6">Tỉ lệ lấp đầy theo giờ</h3>
      <div className="flex h-64 items-end gap-2 pt-6 border-b border-l border-slate-100 px-4">
        {data.map((d, index) => {
          const heightPercent = (d.occupied / maxOccupied) * 100;
          return (
            <div className="flex-1 flex flex-col items-center group relative h-full justify-end" key={index}>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] rounded py-1 px-2 pointer-events-none z-10 whitespace-nowrap">
                <span>{d.occupied} xe đang gửi</span>
              </div>
              {/* Bar */}
              <div
                className="w-full bg-emerald-500 rounded-t transition-all duration-300 hover:bg-emerald-600"
                style={{ height: `${Math.max(heightPercent, 2)}%` }}
              />
              {/* Label */}
              <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                {d.hour}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

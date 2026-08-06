import React from "react";
import { PeakHourPoint } from "@/types";

export function PeakHoursHeatmap({ data }: { data: PeakHourPoint[] }) {
  if (!data || data.length === 0) {
    return <p className="muted-cell text-slate-500 text-sm">Chưa có dữ liệu giờ cao điểm.</p>;
  }

  const maxSessions = Math.max(...data.map((d) => d.sessions), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mt-4">
      <h3 className="text-sm font-bold text-slate-900 mb-6">Mật độ lưu lượng xe theo giờ (Heatmap)</h3>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-3">
        {data.map((d, index) => {
          const ratio = d.sessions / maxSessions;
          let bgColor = "bg-slate-50 text-slate-400";
          if (ratio > 0.8) {
            bgColor = "bg-red-600 text-white font-bold";
          } else if (ratio > 0.5) {
            bgColor = "bg-orange-500 text-white";
          } else if (ratio > 0.2) {
            bgColor = "bg-amber-400 text-slate-900";
          } else if (ratio > 0) {
            bgColor = "bg-blue-100 text-blue-800";
          }

          return (
            <div
              className={`flex flex-col items-center justify-center p-3 rounded-lg border border-slate-100 ${bgColor} transition-transform hover:scale-105 group relative`}
              key={index}
            >
              <span className="text-xs">{d.hour}h</span>
              <strong className="text-sm mt-1">{d.sessions}</strong>
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-900 text-white text-[10px] rounded py-0.5 px-1.5 whitespace-nowrap z-10">
                {d.sessions} lượt vào/ra
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-6 text-xs text-slate-500 justify-end">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-slate-50 border border-slate-200 rounded" /> Trống</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-100 rounded" /> Thấp</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-400 rounded" /> Vừa</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-orange-500 rounded" /> Cao</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-600 rounded" /> Rất cao</span>
      </div>
    </div>
  );
}

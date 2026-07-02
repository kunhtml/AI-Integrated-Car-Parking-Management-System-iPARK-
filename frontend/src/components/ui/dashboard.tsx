import { BarChart3, Car, CreditCard, ParkingCircle, ReceiptText } from "lucide-react";

import { Metric } from "./metric";

const defaultHourlyPerformance: [string, number][] = [
  ["06:00", 25],
  ["08:00", 65],
  ["10:00", 50],
  ["12:00", 45],
  ["14:00", 60],
  ["16:00", 75],
];

export function Dashboard({
  active,
  available,
  completion,
  revenue,
  hourlyPerformance = defaultHourlyPerformance,
  reportsOnly = false,
  loading = false,
}: {
  active: number;
  available: number;
  completion: number;
  revenue: number;
  hourlyPerformance?: [string, number][];
  reportsOnly?: boolean;
  loading?: boolean;
}) {
  const formattedRevenue = new Intl.NumberFormat("vi-VN").format(revenue) + " đ";

  return (
    <section className="dashboard">
      <div className="metric-grid">
        <Metric icon={<Car size={20} className="text-blue-500" />} label="Xe đang gửi" value={loading ? "..." : String(active)} />
        <Metric icon={<ParkingCircle size={20} className="text-blue-500" />} label="Chỗ còn trống" value={loading ? "..." : String(available)} />
        <Metric icon={<CreditCard size={20} className="text-blue-500" />} label="Doanh thu hôm nay" value={loading ? "..." : formattedRevenue} />
        <Metric icon={<ReceiptText size={20} className="text-blue-500" />} label="Phiên đã hoàn thành" value={loading ? "..." : String(completion)} />
      </div>

      <div className="panel dashboard-overview-panel mt-6">
        <div className="panel-heading flex items-center justify-between pb-6 border-b border-slate-100">
          <div>
            <p className="text-xs text-slate-400 font-medium">{reportsOnly ? "Báo cáo" : "Tổng quan"}</p>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">Hiệu suất bãi xe trong ngày</h2>
          </div>
          <BarChart3 className="text-slate-400" size={22} />
        </div>

        <div className="chart-bars mt-6 flex items-end justify-between gap-4 h-48 px-4">
          {(hourlyPerformance.length > 0 ? hourlyPerformance : defaultHourlyPerformance).map(([label, value]) => (
            <div className="bar-item flex flex-col items-center gap-2 flex-1 h-full justify-end" key={label}>
              <div
                className="w-full max-w-[48px] bg-blue-500 hover:bg-blue-600 transition-all rounded-t-sm"
                style={{ height: `${Math.max(value, 4)}%` }}
              />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

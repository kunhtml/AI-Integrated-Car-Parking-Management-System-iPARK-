import React from "react";
import { BarChart, Car, CreditCard, ParkingCircle, ReceiptText } from "lucide-react";
import { Metric } from "./metric";

type Props = {
  active: number;
  available: number;
  revenue: number;
  completion: number;
  loading?: boolean;
  reportsOnly?: boolean;
};

export function Dashboard({ active, available, revenue, completion, loading, reportsOnly }: Props) {
  const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
  const chartData = [
    ["06:00", 0],
    ["08:00", 0],
    ["10:00", 0],
    ["12:00", 0],
    ["14:00", 0],
    ["16:00", 0],
  ] as const;

  return (
    <section className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8">
          <p className="text-sm text-slate-500">{reportsOnly ? "Báo cáo" : "Tổng quan"}</p>
          <h1 className="text-3xl font-black text-slate-900">Dashboard Overview</h1>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <Metric icon={<Car />} label="Xe đang gửi" value={loading ? "..." : String(active)} />
          <Metric icon={<ParkingCircle />} label="Chỗ còn trống" value={loading ? "..." : String(available)} />
          <Metric icon={<CreditCard />} label="Doanh thu hôm nay" value={loading ? "..." : currency.format(revenue)} />
          <Metric icon={<ReceiptText />} label="Phiên đã hoàn thành" value={loading ? "..." : String(completion)} />
        </div>

        <div className="rounded-lg border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs text-slate-500">{reportsOnly ? "Báo cáo" : "Tổng quan"}</p>
              <h2 className="font-bold text-slate-900">Hiệu suất bãi xe trong ngày</h2>
            </div>
            <BarChart size={22} />
          </div>
          <div className="grid h-52 grid-cols-6 items-end gap-4">
            {chartData.map(([label, value]) => (
              <div className="flex h-full flex-col items-center justify-end" key={label}>
                <div
                  className="w-10 rounded-t bg-blue-50"
                  style={{ height: value > 0 ? `${value}%` : "4px" }}
                />
                <span className="mt-2 text-xs text-slate-600">{label}</span>
              </div>
            ))}
          </div>
          {!loading && active === 0 && completion === 0 && revenue === 0 && (
            <p className="mt-4 text-center text-sm text-slate-500">Chưa có dữ liệu từ cơ sở dữ liệu.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default Dashboard;

import React from "react";
import { Metric } from "./metric";
import { Car, ParkingCircle, CreditCard, ReceiptText, BarChart } from "lucide-react";
import { parkingConfig } from "@/lib/parking-config";

type Props = {
  active: number;
  available: number;
  revenue: number;
  completion: number;
  reportsOnly?: boolean;
};

export function Dashboard({ active, available, revenue, completion, reportsOnly }: Props) {
  const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl w-full mx-auto px-6">
        <div className="mb-8 text-center max-w-2xl mx-auto">
          <p className="text-sm text-slate-500">{reportsOnly ? "Báo cáo" : "Tổng quan"}</p>
          <h2 className="text-3xl font-black text-slate-900">Hiệu suất bãi xe trong ngày</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Metric icon={<Car />} label="Xe đang gửi" value={String(active)} />
          <Metric icon={<ParkingCircle />} label="Chỗ còn trống" value={String(available)} />
          <Metric icon={<CreditCard />} label="Doanh thu hôm nay" value={currency.format(revenue)} />
          <Metric icon={<ReceiptText />} label="Phiên đã hoàn thành" value={String(completion)} />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <p className="text-xs text-slate-500">{reportsOnly ? "Báo cáo" : "Tổng quan"}</p>
              <h3 className="font-bold text-slate-900">Hiệu suất bãi xe trong ngày</h3>
            </div>
            <BarChart size={22} />
          </div>
          <div className="grid grid-cols-6 gap-4 items-end">
            {[
              ["06:00", 38],
              ["08:00", 82],
              ["10:00", 64],
              ["12:00", 56],
              ["14:00", 73],
              ["16:00", 91],
            ].map(([label, value]) => (
              <div className="flex flex-col items-center" key={label}>
                <div className="w-10 bg-blue-50 rounded-t" style={{ height: `${value}%` }} />
                <span className="text-xs text-slate-600 mt-2">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Dashboard;
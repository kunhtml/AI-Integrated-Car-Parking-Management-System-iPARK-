import { BarChart3, Car, CreditCard, ParkingCircle, ReceiptText } from "lucide-react";

import { currency } from "@/lib/constants";
import { Metric } from "./metric";

export function Dashboard({
  active,
  available,
  completion,
  revenue,
  reportsOnly = false,
}: {
  active: number;
  available: number;
  completion: number;
  revenue: number;
  reportsOnly?: boolean;
}) {
  return (
    <section className="dashboard">
      <div className="metric-grid">
        <Metric icon={<Car />} label="Xe đang gửi" value={String(active)} />
        <Metric icon={<ParkingCircle />} label="Chỗ còn trống" value={String(available)} />
        <Metric icon={<CreditCard />} label="Doanh thu hôm nay" value={currency.format(revenue)} />
        <Metric icon={<ReceiptText />} label="Phiên đã hoàn thành" value={String(completion)} />
      </div>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>{reportsOnly ? "Báo cáo" : "Tổng quan"}</p>
            <h2>Hiệu suất bãi xe trong ngày</h2>
          </div>
          <BarChart3 size={22} />
        </div>
        <div className="chart-bars">
          {[
            ["06:00", 38],
            ["08:00", 82],
            ["10:00", 64],
            ["12:00", 56],
            ["14:00", 73],
            ["16:00", 91],
          ].map(([label, value]) => (
            <div className="bar-item" key={label}>
              <div style={{ height: `${value}%` }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

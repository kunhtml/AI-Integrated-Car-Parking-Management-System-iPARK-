"use client";

import { useMemo, useState } from "react";
import { BarChart, Car, CreditCard, ReceiptText, Save } from "lucide-react";

type ReportPoint = {
  label: string;
  revenue: number;
  entries: number;
  exits: number;
  occupancy: number;
};

type ExportRow = {
  fileName: string;
  period: string;
  createdBy: string;
  status: "Ready" | "Processing" | "Failed";
};

const reportData: ReportPoint[] = [
  { label: "Mon", revenue: 1850000, entries: 84, exits: 79, occupancy: 58 },
  { label: "Tue", revenue: 2360000, entries: 103, exits: 98, occupancy: 64 },
  { label: "Wed", revenue: 2140000, entries: 96, exits: 94, occupancy: 61 },
  { label: "Thu", revenue: 2920000, entries: 128, exits: 120, occupancy: 73 },
  { label: "Fri", revenue: 3180000, entries: 142, exits: 137, occupancy: 81 },
  { label: "Sat", revenue: 1740000, entries: 77, exits: 82, occupancy: 47 },
  { label: "Sun", revenue: 1260000, entries: 58, exits: 61, occupancy: 39 },
];

const exportHistory: ExportRow[] = [
  { fileName: "revenue-weekly-2026-06-20.pdf", period: "This week", createdBy: "Parking Manager", status: "Ready" },
  { fileName: "traffic-capacity-2026-06.xlsx", period: "June 2026", createdBy: "System Admin", status: "Ready" },
  { fileName: "revenue-daily-2026-06-19.pdf", period: "Yesterday", createdBy: "Parking Manager", status: "Processing" },
];

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export function RevenueReportsView() {
  const [dateRange, setDateRange] = useState("this-week");
  const [parkingArea, setParkingArea] = useState("all");
  const [vehicleType, setVehicleType] = useState("car");
  const [message, setMessage] = useState<string | null>(null);

  const summary = useMemo(() => {
    const totalRevenue = reportData.reduce((sum, item) => sum + item.revenue, 0);
    const totalEntries = reportData.reduce((sum, item) => sum + item.entries, 0);
    const totalExits = reportData.reduce((sum, item) => sum + item.exits, 0);
    const avgOccupancy = Math.round(reportData.reduce((sum, item) => sum + item.occupancy, 0) / reportData.length);
    const activeSessions = Math.max(0, totalEntries - totalExits);

    return {
      totalRevenue,
      vehicleCount: totalEntries,
      avgOccupancy,
      avgParkingTime: "2h 18m",
      activeSessions,
      occupiedSlots: Math.round((30 * avgOccupancy) / 100),
      totalSlots: 30,
    };
  }, []);

  const maxRevenue = Math.max(...reportData.map((item) => item.revenue));
  const maxTraffic = Math.max(...reportData.map((item) => item.entries));

  function handleApplyFilter() {
    setMessage("Đã áp dụng bộ lọc. Dữ liệu mẫu được cập nhật theo trạng thái filtered trong screen spec.");
  }

  function handleExport(format: "PDF" | "Excel") {
    setMessage(`Đã tạo yêu cầu xuất báo cáo ${format}. Export history sẽ ghi nhận file sau khi backend được nối.`);
  }

  return (
    <section className="bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm text-slate-500">P-04d • FT-08 Reporting & Analytics</p>
              <h1 className="text-2xl font-bold text-slate-900">Reporting Dashboard - Revenue, Traffic & Capacity</h1>
              <p className="mt-1 text-sm text-slate-500">
                Last updated: 20/06/2026 13:40 • Selected period: {periodLabel(dateRange)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => handleExport("PDF")}
                type="button"
              >
                <ReceiptText size={16} />
                Export PDF
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                onClick={() => handleExport("Excel")}
                type="button"
              >
                <Save size={16} />
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {message && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <SelectField label="Date range" onChange={setDateRange} value={dateRange}>
              <option value="today">Today</option>
              <option value="this-week">This week</option>
              <option value="this-month">This month</option>
              <option value="custom">Custom range</option>
            </SelectField>
            <SelectField label="Parking area" onChange={setParkingArea} value={parkingArea}>
              <option value="all">All areas</option>
              <option value="zone-a">Zone A</option>
              <option value="zone-b">Zone B</option>
              <option value="zone-c">Zone C</option>
            </SelectField>
            <SelectField label="Vehicle type" onChange={setVehicleType} value={vehicleType}>
              <option value="car">Ô tô</option>
              <option value="member">Member vehicles</option>
              <option value="guest">Guest vehicles</option>
            </SelectField>
            <div className="flex items-end">
              <button
                className="h-10 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 md:w-auto"
                onClick={handleApplyFilter}
                type="button"
              >
                Apply
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <FilterChip label={periodLabel(dateRange)} />
            <FilterChip label={areaLabel(parkingArea)} />
            <FilterChip label={vehicleLabel(vehicleType)} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <KpiCard icon={<CreditCard size={20} />} label="Total Revenue" value={currency.format(summary.totalRevenue)} />
          <KpiCard icon={<Car size={20} />} label="Vehicle Count" value={String(summary.vehicleCount)} />
          <KpiCard icon={<BarChart size={20} />} label="Occupancy Rate" value={`${summary.avgOccupancy}%`} />
          <KpiCard icon={<ReceiptText size={20} />} label="Avg Parking Time" value={summary.avgParkingTime} />
          <KpiCard icon={<Car size={20} />} label="Active Sessions" value={String(summary.activeSessions)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartPanel title="Revenue Chart" subtitle="Line/bar by day for the selected period">
            <div className="grid h-64 grid-cols-7 items-end gap-3">
              {reportData.map((item) => (
                <div className="flex h-full flex-col items-center justify-end" key={item.label}>
                  <div className="w-full rounded-t bg-blue-100" style={{ height: `${Math.max(6, (item.revenue / maxRevenue) * 100)}%` }} />
                  <span className="mt-2 text-xs font-semibold text-slate-600">{item.label}</span>
                </div>
              ))}
            </div>
          </ChartPanel>

          <ChartPanel title="Vehicle Traffic Chart" subtitle="Entry vs exit volume">
            <div className="grid h-64 grid-cols-7 items-end gap-3">
              {reportData.map((item) => (
                <div className="flex h-full flex-col items-center justify-end gap-1" key={item.label}>
                  <div className="flex h-full w-full items-end gap-1">
                    <div className="flex-1 rounded-t bg-emerald-100" style={{ height: `${Math.max(6, (item.entries / maxTraffic) * 100)}%` }} />
                    <div className="flex-1 rounded-t bg-amber-100" style={{ height: `${Math.max(6, (item.exits / maxTraffic) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-600">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Entry</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-300" /> Exit</span>
            </div>
          </ChartPanel>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Capacity Widget</h2>
                <p className="text-sm text-slate-500">Occupied slots / total capacity / threshold</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Normal</span>
            </div>
            <div className="mb-3 flex items-end justify-between">
              <strong className="text-3xl text-slate-900">{summary.occupiedSlots}/{summary.totalSlots}</strong>
              <span className="text-sm text-slate-500">Threshold 85%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-blue-600" style={{ width: `${summary.avgOccupancy}%` }} />
            </div>
            <button className="mt-5 w-full rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" type="button">
              Open Capacity Configuration
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="font-bold text-slate-900">Recent Export History</h2>
              <p className="text-sm text-slate-500">The system records report export history after PDF/Excel generation.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                    <th className="py-3 pr-4">File name</th>
                    <th className="py-3 pr-4">Period</th>
                    <th className="py-3 pr-4">Created by</th>
                    <th className="py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exportHistory.map((item) => (
                    <tr className="border-b border-slate-100 last:border-0" key={item.fileName}>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-700">{item.fileName}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.period}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.createdBy}</td>
                      <td className="py-3 text-right">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectField({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" onChange={(event) => onChange(event.target.value)} value={value}>
        {children}
      </select>
    </label>
  );
}

function FilterChip({ label }: { label: string }) {
  return <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{label}</span>;
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">{icon}</div>
      <p className="text-xs text-slate-500">{label}</p>
      <strong className="text-xl text-slate-900">{value}</strong>
    </div>
  );
}

function ChartPanel({ children, subtitle, title }: { children: React.ReactNode; subtitle: string; title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function periodLabel(value: string) {
  if (value === "today") return "Today";
  if (value === "this-month") return "This month";
  if (value === "custom") return "Custom range";
  return "This week";
}

function areaLabel(value: string) {
  if (value === "zone-a") return "Zone A";
  if (value === "zone-b") return "Zone B";
  if (value === "zone-c") return "Zone C";
  return "All areas";
}

function vehicleLabel(value: string) {
  if (value === "member") return "Member vehicles";
  if (value === "guest") return "Guest vehicles";
  return "Ô tô";
}

function statusClass(status: ExportRow["status"]) {
  if (status === "Ready") return "bg-emerald-50 text-emerald-700";
  if (status === "Processing") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

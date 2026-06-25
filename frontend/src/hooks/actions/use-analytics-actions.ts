import { apiFetch } from "@/lib/client-api";
import type { OccupancyHourPoint, PeakHourPoint, RevenueChartPoint, TopCustomer } from "@/types";

type AnalyticsActionsParams = {
  setRevenueChart: (data: RevenueChartPoint[]) => void;
  setOccupancyData: (data: OccupancyHourPoint[]) => void;
  setTopCustomers: (data: TopCustomer[]) => void;
  setPeakHours: (data: PeakHourPoint[]) => void;
  setActionLog: (log: string) => void;
};

export function createAnalyticsActions({
  setRevenueChart,
  setOccupancyData,
  setTopCustomers,
  setPeakHours,
  setActionLog,
}: AnalyticsActionsParams) {
  async function loadRevenueChart(from: string, to: string, groupBy: string = "day") {
    const params = new URLSearchParams({ from, to, groupBy });
    const response = await apiFetch(`/reports/revenue-chart?${params}`);
    if (response.ok) {
      const json = await response.json();
      setRevenueChart(json.data);
    } else {
      setActionLog("Không tải được dữ liệu doanh thu.");
    }
  }

  async function loadOccupancyHourly(from: string, to: string) {
    const params = new URLSearchParams({ from, to });
    const response = await apiFetch(`/reports/occupancy-hourly?${params}`);
    if (response.ok) {
      const json = await response.json();
      setOccupancyData(json.data);
    } else {
      setActionLog("Không tải được dữ liệu lấp đầy.");
    }
  }

  async function loadTopCustomers(from: string, to: string, limit: number = 10) {
    const params = new URLSearchParams({ from, to, limit: String(limit) });
    const response = await apiFetch(`/reports/top-customers?${params}`);
    if (response.ok) {
      const json = await response.json();
      setTopCustomers(json.data);
    } else {
      setActionLog("Không tải được top khách hàng.");
    }
  }

  async function loadPeakHours(from: string, to: string) {
    const params = new URLSearchParams({ from, to });
    const response = await apiFetch(`/reports/peak-hours?${params}`);
    if (response.ok) {
      const json = await response.json();
      setPeakHours(json.data);
    } else {
      setActionLog("Không tải được dữ liệu giờ cao điểm.");
    }
  }

  return { loadRevenueChart, loadOccupancyHourly, loadTopCustomers, loadPeakHours };
}

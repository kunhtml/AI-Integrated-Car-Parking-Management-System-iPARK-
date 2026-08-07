"use client";

import { useState } from "react";
import {
  BarChart3,
  MapPin,
  Wallet,
  FileDown,
  FileText,
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/metric-card";
import { OccupancyChart } from "@/components/dashboard/occupancy-chart";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ChartSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { RevenueChart } from "./revenue-chart";
import { TopCustomersTable } from "./top-customers-table";
import { PeakHoursHeatmap } from "./peak-hours-heatmap";
import type { DateRange } from "react-day-picker";
import { addDays } from "date-fns";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function ReportsView() {
  const {
    currentUser,
    reportSummary,
    reportFrom,
    setReportFrom,
    reportTo,
    setReportTo,
    loadReportSummary,
    downloadReport,
    revenueChart,
    occupancyData,
    topCustomers,
    peakHours,
    loadRevenueChart,
    loadOccupancyHourly,
    loadTopCustomers,
    loadPeakHours,
  } = useParkingApp() as any;

  const [activeTab, setActiveTab] = useState("summary");
  const [chartFrom, setChartFrom] = useState(monthAgoStr());
  const [chartTo, setChartTo] = useState(todayStr());
  const [groupBy, setGroupBy] = useState("day");
  const [chartDateRange, setChartDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [penaltyData, setPenaltyData] = useState<any>(null);
  const [walletData, setWalletData] = useState<any>(null);
  const [entryZoneData, setEntryZoneData] = useState<any[]>([]);
  const [exitZoneData, setExitZoneData] = useState<any[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);

  if (!currentUser || currentUser.role !== "admin") return null;

  async function loadChartData() {
    setLoadingTab(true);
    const params = `?from=${chartFrom}&to=${chartTo}`;
    try {
      if (activeTab === "revenue") await loadRevenueChart(chartFrom, chartTo, groupBy);
      if (activeTab === "occupancy") await loadOccupancyHourly(chartFrom, chartTo);
      if (activeTab === "customers") await loadTopCustomers(chartFrom, chartTo, 10);
      if (activeTab === "peak") await loadPeakHours(chartFrom, chartTo);
      if (activeTab === "penalty") {
        const r = await apiFetch(`/reports/penalty${params}`);
        if (r.ok) setPenaltyData((await r.json()).data);
      }
      if (activeTab === "wallet") {
        const r = await apiFetch(`/reports/wallet${params}`);
        if (r.ok) setWalletData((await r.json()).data);
      }
      if (activeTab === "zones") {
        const [entryRes, exitRes] = await Promise.all([
          apiFetch(`/reports/entry-by-zone${params}`),
          apiFetch(`/reports/exit-by-zone${params}`),
        ]);
        if (entryRes.ok) setEntryZoneData((await entryRes.json()).data);
        if (exitRes.ok) setExitZoneData((await exitRes.json()).data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTab(false);
    }
  }

  const tabs = [
    { value: "summary", label: "Tổng quan", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { value: "revenue", label: "Doanh thu", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { value: "occupancy", label: "Lấp đầy", icon: <MapPin className="h-3.5 w-3.5" /> },
    { value: "customers", label: "Khách hàng", icon: <Users className="h-3.5 w-3.5" /> },
    { value: "peak", label: "Giờ cao điểm", icon: <Clock className="h-3.5 w-3.5" /> },
    { value: "penalty", label: "Phạt", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { value: "wallet", label: "Ví", icon: <Wallet className="h-3.5 w-3.5" /> },
    { value: "zones", label: "Theo zone", icon: <MapPin className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Báo cáo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Thống kê & Phân tích
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Summary Tab ── */}
        <TabsContent value="summary" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Báo cáo tổng quan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3 mb-6">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Từ ngày</label>
                  <input
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Đến ngày</label>
                  <input
                    type="date"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <Button size="sm" onClick={() => loadReportSummary(reportFrom, reportTo)}>
                  Tải báo cáo
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadReport("sessions", "xlsx")}>
                  <FileDown className="h-4 w-4 mr-1" />
                  Excel
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadReport("revenue", "pdf")}>
                  <FileText className="h-4 w-4 mr-1" />
                  PDF
                </Button>
              </div>

              {reportSummary ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <MetricCard title="Xe vào" value={formatNumber(reportSummary.entryCount)} icon={<TrendingUp className="h-4 w-4" />} />
                  <MetricCard title="Xe ra" value={formatNumber(reportSummary.exitCount)} icon={<TrendingUp className="h-4 w-4" />} />
                  <MetricCard title="Đang gửi" value={formatNumber(reportSummary.activeCount)} icon={<CreditCard className="h-4 w-4" />} />
                  <MetricCard title="Doanh thu" value={currency.format(reportSummary.revenue)} icon={<TrendingUp className="h-4 w-4" />} />
                  <MetricCard title="Phiên miễn phí" value={formatNumber(reportSummary.freeSessionCount)} icon={<FileText className="h-4 w-4" />} />
                  <MetricCard title="Phiên có phí" value={formatNumber(reportSummary.paidSessionCount)} icon={<FileText className="h-4 w-4" />} />
                </div>
              ) : (
                <EmptyState title="Chưa có dữ liệu" description="Chọn khoảng thời gian và nhấn 'Tải báo cáo'" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Chart Tabs ── */}
        {["revenue", "occupancy", "customers", "peak", "penalty", "wallet", "zones"].map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue} className="mt-4 space-y-4">
            {/* Filter bar */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Từ ngày</label>
                    <input
                      type="date"
                      value={chartFrom}
                      onChange={(e) => setChartFrom(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Đến ngày</label>
                    <input
                      type="date"
                      value={chartTo}
                      onChange={(e) => setChartTo(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  {tabValue === "revenue" && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Nhóm theo</label>
                      <select
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="day">Theo ngày</option>
                        <option value="week">Theo tuần</option>
                        <option value="month">Theo tháng</option>
                      </select>
                    </div>
                  )}
                  <Button size="sm" onClick={loadChartData} disabled={loadingTab}>
                    {loadingTab ? "Đang tải..." : "Tải dữ liệu"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tab content */}
            {tabValue === "revenue" && <RevenueChart data={revenueChart} />}
            {tabValue === "occupancy" && (
              <OccupancyChart
                data={(occupancyData || []).map((d: any) => ({
                  label: d.hour !== undefined ? `${d.hour}h` : d.label,
                  occupancy: d.occupancy || 0,
                }))}
              />
            )}
            {tabValue === "customers" && <TopCustomersTable data={topCustomers} />}
            {tabValue === "peak" && <PeakHoursHeatmap data={peakHours} />}

            {tabValue === "penalty" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Báo cáo quá hạn</CardTitle>
                </CardHeader>
                <CardContent>
                  {penaltyData ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <MetricCard title="Tổng phiên quá hạn" value={penaltyData.summary.totalOverdue} icon={<AlertTriangle className="h-4 w-4" />} />
                        <MetricCard title="Tổng phút quá hạn" value={penaltyData.summary.totalOverdueMinutes} icon={<Clock className="h-4 w-4" />} />
                        <MetricCard title="TB phút quá hạn" value={penaltyData.summary.avgOverdueMinutes} icon={<Clock className="h-4 w-4" />} />
                      </div>
                      {penaltyData.topOverdue.length > 0 && (
                        <div className="rounded-lg border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Biển số</th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Chủ xe</th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slot</th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Zone</th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Quá hạn</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Phí</th>
                              </tr>
                            </thead>
                            <tbody>
                              {penaltyData.topOverdue.map((item: any) => (
                                <tr key={item.id} className="border-b last:border-0">
                                  <td className="px-4 py-3 font-medium">{item.plate}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{item.ownerName}</td>
                                  <td className="px-4 py-3">{item.slot}</td>
                                  <td className="px-4 py-3">{item.zone}</td>
                                  <td className="px-4 py-3"><Badge variant="warning">{item.overdueMinutes} phút</Badge></td>
                                  <td className="px-4 py-3 text-right font-medium">{currency.format(item.fee)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <EmptyState title="Chưa có dữ liệu" description="Nhấn 'Tải dữ liệu' để xem báo cáo phạt" />
                  )}
                </CardContent>
              </Card>
            )}

            {tabValue === "wallet" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Báo cáo ví</CardTitle>
                </CardHeader>
                <CardContent>
                  {walletData ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <MetricCard title="Số lần nạp" value={walletData.topUps.count} icon={<CreditCard className="h-4 w-4" />} />
                      <MetricCard title="Tổng nạp" value={currency.format(walletData.topUps.amount)} icon={<TrendingUp className="h-4 w-4" />} />
                      <MetricCard title="Số lần trừ ví" value={walletData.walletPayments.count} icon={<CreditCard className="h-4 w-4" />} />
                      <MetricCard title="Tổng trừ" value={currency.format(walletData.walletPayments.amount)} icon={<TrendingUp className="h-4 w-4" />} />
                      <MetricCard title="Dòng tiền ròng" value={currency.format(walletData.netFlow)} icon={<Wallet className="h-4 w-4" />} />
                    </div>
                  ) : (
                    <EmptyState title="Chưa có dữ liệu" description="Nhấn 'Tải dữ liệu' để xem báo cáo ví" />
                  )}
                </CardContent>
              </Card>
            )}

            {tabValue === "zones" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Xe vào/ra theo khu vực</CardTitle>
                </CardHeader>
                <CardContent>
                  {entryZoneData.length > 0 || exitZoneData.length > 0 ? (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Xe vào</h3>
                        <div className="rounded-lg border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Zone</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Số lượt vào</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entryZoneData.map((z: any) => (
                                <tr key={z.zone} className="border-b last:border-0">
                                  <td className="px-4 py-3 font-medium">{z.zone}</td>
                                  <td className="px-4 py-3 text-right">{z.entryCount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Xe ra</h3>
                        <div className="rounded-lg border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Zone</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Số lượt ra</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Doanh thu</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exitZoneData.map((z: any) => (
                                <tr key={z.zone} className="border-b last:border-0">
                                  <td className="px-4 py-3 font-medium">{z.zone}</td>
                                  <td className="px-4 py-3 text-right">{z.exitCount}</td>
                                  <td className="px-4 py-3 text-right font-medium">{currency.format(z.revenue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState title="Chưa có dữ liệu" description="Nhấn 'Tải dữ liệu' để xem báo cáo theo zone" />
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

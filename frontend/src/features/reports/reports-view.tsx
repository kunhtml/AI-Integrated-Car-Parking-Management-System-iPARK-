"use client";

import { useState } from "react";
import { BarChart3, Download, MapPin, ShieldAlert, TrendingUp, Users, Clock, Wallet } from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";
import { RevenueChart } from "./revenue-chart";
import { OccupancyChart } from "./occupancy-chart";
import { TopCustomersTable } from "./top-customers-table";
import { PeakHoursHeatmap } from "./peak-hours-heatmap";

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
  } = useParkingApp();

  const [activeTab, setActiveTab] = useState<"summary" | "revenue" | "occupancy" | "customers" | "peak" | "penalty" | "wallet" | "zones">("summary");
  const [chartFrom, setChartFrom] = useState(monthAgoStr());
  const [chartTo, setChartTo] = useState(todayStr());
  const [groupBy, setGroupBy] = useState("day");
  const [penaltyData, setPenaltyData] = useState<any>(null);
  const [walletData, setWalletData] = useState<any>(null);
  const [entryZoneData, setEntryZoneData] = useState<any[]>([]);
  const [exitZoneData, setExitZoneData] = useState<any[]>([]);

  if (!currentUser || currentUser.role !== "admin") return null;

  function loadChartData() {
    const params = `?from=${chartFrom}&to=${chartTo}`;
    if (activeTab === "revenue") loadRevenueChart(chartFrom, chartTo, groupBy);
    if (activeTab === "occupancy") loadOccupancyHourly(chartFrom, chartTo);
    if (activeTab === "customers") loadTopCustomers(chartFrom, chartTo, 10);
    if (activeTab === "peak") loadPeakHours(chartFrom, chartTo);
    if (activeTab === "penalty") {
      apiFetch(`/reports/penalty${params}`).then(async (r) => {
        if (r.ok) setPenaltyData((await r.json()).data);
      });
    }
    if (activeTab === "wallet") {
      apiFetch(`/reports/wallet${params}`).then(async (r) => {
        if (r.ok) setWalletData((await r.json()).data);
      });
    }
    if (activeTab === "zones") {
      Promise.all([
        apiFetch(`/reports/entry-by-zone${params}`),
        apiFetch(`/reports/exit-by-zone${params}`),
      ]).then(async ([entryRes, exitRes]) => {
        if (entryRes.ok) setEntryZoneData((await entryRes.json()).data);
        if (exitRes.ok) setExitZoneData((await exitRes.json()).data);
      });
    }
  }

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Báo cáo</p>
            <h2>Thống kê & Phân tích</h2>
          </div>
          <BarChart3 size={22} />
        </div>

        <div className="tab-bar">
          {([
            ["summary", "Tổng quan"],
            ["revenue", "Doanh thu"],
            ["occupancy", "Lấp đầy"],
            ["customers", "Khách hàng"],
            ["peak", "Giờ cao điểm"],
            ["penalty", "Phạt"],
            ["wallet", "Ví"],
            ["zones", "Theo zone"],
          ] as const).map(([key, label]) => (
            <button
              className={`tab-item${activeTab === key ? " tab-active" : ""}`}
              key={key}
              onClick={() => setActiveTab(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Summary tab */}
        {activeTab === "summary" && (
          <div>
            <div className="filter-row">
              <input onChange={(e) => setReportFrom(e.target.value)} type="date" value={reportFrom} />
              <input onChange={(e) => setReportTo(e.target.value)} type="date" value={reportTo} />
              <button className="small-button" onClick={() => loadReportSummary(reportFrom, reportTo)} type="button">
                Tải báo cáo
              </button>
              <button className="small-button" onClick={() => downloadReport("sessions", "xlsx")} type="button">
                <Download size={14} /> Excel
              </button>
              <button className="small-button" onClick={() => downloadReport("revenue", "pdf")} type="button">
                <Download size={14} /> PDF
              </button>
            </div>
            {reportSummary && (
              <div className="metric-grid" style={{ marginTop: 16 }}>
                <div className="metric-card"><span>Xe vào</span><strong>{reportSummary.entryCount}</strong></div>
                <div className="metric-card"><span>Xe ra</span><strong>{reportSummary.exitCount}</strong></div>
                <div className="metric-card"><span>Đang gửi</span><strong>{reportSummary.activeCount}</strong></div>
                <div className="metric-card"><span>Doanh thu</span><strong>{currency.format(reportSummary.revenue)}</strong></div>
                <div className="metric-card"><span>Phiên miễn phí</span><strong>{reportSummary.freeSessionCount}</strong></div>
                <div className="metric-card"><span>Phiên có phí</span><strong>{reportSummary.paidSessionCount}</strong></div>
              </div>
            )}
          </div>
        )}

        {/* Chart tabs */}
        {activeTab !== "summary" && (
          <div>
            <div className="filter-row">
              <input onChange={(e) => setChartFrom(e.target.value)} type="date" value={chartFrom} />
              <input onChange={(e) => setChartTo(e.target.value)} type="date" value={chartTo} />
              {activeTab === "revenue" && (
                <select onChange={(e) => setGroupBy(e.target.value)} value={groupBy}>
                  <option value="day">Theo ngày</option>
                  <option value="week">Theo tuần</option>
                  <option value="month">Theo tháng</option>
                </select>
              )}
              <button className="small-button" onClick={loadChartData} type="button">
                Tải dữ liệu
              </button>
            </div>

            {activeTab === "revenue" && <RevenueChart data={revenueChart} />}
            {activeTab === "occupancy" && <OccupancyChart data={occupancyData} />}
            {activeTab === "customers" && <TopCustomersTable data={topCustomers} />}
            {activeTab === "peak" && <PeakHoursHeatmap data={peakHours} />}

            {/* Penalty Report */}
            {activeTab === "penalty" && (
              <div>
                <div className="panel-heading"><div><p>Phạt</p><h2>Báo cáo quá hạn</h2></div><ShieldAlert size={20} /></div>
                {penaltyData ? (
                  <>
                    <div className="metric-grid" style={{ marginBottom: 16 }}>
                      <div className="metric-card"><span>Tổng phiên quá hạn</span><strong>{penaltyData.summary.totalOverdue}</strong></div>
                      <div className="metric-card"><span>Tổng phút quá hạn</span><strong>{penaltyData.summary.totalOverdueMinutes}</strong></div>
                      <div className="metric-card"><span>TB phút quá hạn</span><strong>{penaltyData.summary.avgOverdueMinutes}</strong></div>
                    </div>
                    {penaltyData.topOverdue.length > 0 && (
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Biển số</th><th>Chủ xe</th><th>Slot</th><th>Zone</th><th>Quá hạn (phút)</th><th>Phí</th></tr></thead>
                          <tbody>
                            {penaltyData.topOverdue.map((item: any) => (
                              <tr key={item.id}>
                                <td><strong>{item.plate}</strong></td>
                                <td>{item.ownerName}</td>
                                <td>{item.slot}</td>
                                <td>{item.zone}</td>
                                <td><span className="badge warning">{item.overdueMinutes}</span></td>
                                <td>{currency.format(item.fee)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : <p className="muted-cell">Nhấn "Tải dữ liệu" để xem báo cáo phạt.</p>}
              </div>
            )}

            {/* Wallet Report */}
            {activeTab === "wallet" && (
              <div>
                <div className="panel-heading"><div><p>Ví</p><h2>Báo cáo hoạt động ví</h2></div><Wallet size={20} /></div>
                {walletData ? (
                  <div className="metric-grid">
                    <div className="metric-card"><span>Số lần nạp</span><strong>{walletData.topUps.count}</strong></div>
                    <div className="metric-card"><span>Tổng nạp</span><strong>{currency.format(walletData.topUps.amount)}</strong></div>
                    <div className="metric-card"><span>Số lần trừ ví</span><strong>{walletData.walletPayments.count}</strong></div>
                    <div className="metric-card"><span>Tổng trừ</span><strong>{currency.format(walletData.walletPayments.amount)}</strong></div>
                    <div className="metric-card"><span>Dòng tiền ròng</span><strong>{currency.format(walletData.netFlow)}</strong></div>
                  </div>
                ) : <p className="muted-cell">Nhấn "Tải dữ liệu" để xem báo cáo ví.</p>}
              </div>
            )}

            {/* Entry/Exit by Zone Report */}
            {activeTab === "zones" && (
              <div>
                <div className="panel-heading"><div><p>Zone</p><h2>Xe vào/ra theo khu vực</h2></div><MapPin size={20} /></div>
                {(entryZoneData.length > 0 || exitZoneData.length > 0) ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <h3 style={{ fontSize: "0.9rem", marginBottom: 8 }}>Xe vào</h3>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Zone</th><th>Số lượt vào</th></tr></thead>
                          <tbody>
                            {entryZoneData.map((z: any) => (
                              <tr key={z.zone}><td><strong>{z.zone}</strong></td><td>{z.entryCount}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "0.9rem", marginBottom: 8 }}>Xe ra</h3>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Zone</th><th>Số lượt ra</th><th>Doanh thu</th></tr></thead>
                          <tbody>
                            {exitZoneData.map((z: any) => (
                              <tr key={z.zone}><td><strong>{z.zone}</strong></td><td>{z.exitCount}</td><td>{currency.format(z.revenue)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : <p className="muted-cell">Nhấn "Tải dữ liệu" để xem báo cáo theo zone.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

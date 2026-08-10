"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calendar,
  Car,
  CheckCircle,
  Clock,
  Download,
  Eye,
  Flame,
  MapPin,
  ParkingCircle,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { currency } from "@/lib/constants";
import type {
  RevenueChartPoint,
  OccupancyHourPoint,
  TopCustomer,
  PeakHourPoint,
  Zone,
} from "@/types";
import type { ReportSummary } from "@/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}
function monthAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: "blue" | "green" | "amber" | "purple" | "cyan" | "red";
}

function KpiCard({ icon, label, value, sub, color }: KpiCardProps) {
  const colors: Record<string, { bg: string; color: string }> = {
    blue: { bg: "rgba(59,130,246,0.08)", color: "#3b82f6" },
    green: { bg: "rgba(16,185,129,0.08)", color: "#10b981" },
    amber: { bg: "rgba(245,158,11,0.08)", color: "#f59e0b" },
    purple: { bg: "rgba(139,92,246,0.08)", color: "#8b5cf6" },
    cyan: { bg: "rgba(6,182,212,0.08)", color: "#06b6d4" },
    red: { bg: "rgba(239,68,68,0.08)", color: "#ef4444" },
  };
  const c = colors[color];
  return (
    <div className="rep-kpi-card">
      <div className="rep-kpi-icon" style={{ background: c.bg, color: c.color }}>
        {icon}
      </div>
      <div className="rep-kpi-body">
        <span className="rep-kpi-label">{label}</span>
        <strong className="rep-kpi-value">{value}</strong>
        {sub && <span className="rep-kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Revenue Bar Chart ──────────────────────────────────────────────────────
interface RepRevenueChartProps {
  data: RevenueChartPoint[];
  groupBy: string;
}

function RepRevenueChart({ data, groupBy }: RepRevenueChartProps) {
  if (!data.length) {
    return <p className="rep-empty">Chưa có dữ liệu. Chọn khoảng thời gian và nhấn "Tải dữ liệu".</p>;
  }
  const maxRev = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="rep-chart-area">
      <div className="rep-bar-chart">
        {data.map((p, i) => (
          <div className="rep-bar-col" key={i}>
            <div className="rep-bar-wrap">
              <div
                className="rep-bar-fill"
                style={{ height: `${(p.revenue / maxRev) * 100}%` }}
                title={currency.format(p.revenue)}
              />
            </div>
            <span className="rep-bar-val">{currency.formatShort(p.revenue)}</span>
            <span className="rep-bar-label">
              {groupBy === "hour"
                ? `${p.date}h`
                : p.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
      <div className="rep-chart-table">
        <table>
          <thead><tr><th>Thời gian</th><th>Doanh thu</th><th>Số giao dịch</th><th>TB/phiên</th></tr></thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={i}>
                <td>{groupBy === "hour" ? `${p.date}h` : p.date}</td>
                <td><strong>{currency.format(p.revenue)}</strong></td>
                <td>{p.count}</td>
                <td>{p.count > 0 ? currency.format(Math.round(p.revenue / p.count)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Occupancy Chart ────────────────────────────────────────────────────────
interface RepOccupancyChartProps {
  data: OccupancyHourPoint[];
}

function RepOccupancyChart({ data }: RepOccupancyChartProps) {
  if (!data.length) {
    return <p className="rep-empty">Chưa có dữ liệu. Chọn khoảng thời gian và nhấn "Tải dữ liệu".</p>;
  }
  const maxOcc = Math.max(...data.map((d) => d.maxOccupancy), 1);

  return (
    <div className="rep-chart-area">
      <div className="rep-bar-chart">
        {data.map((p, i) => {
          const avgPct = maxOcc > 0 ? Math.round((p.avgOccupancy / maxOcc) * 100) : 0;
          const color = avgPct >= 85 ? "#ef4444" : avgPct >= 60 ? "#f59e0b" : "#10b981";
          return (
            <div className="rep-bar-col" key={i}>
              <div className="rep-bar-wrap">
                <div
                  className="rep-bar-fill"
                  style={{ height: `${(p.avgOccupancy / maxOcc) * 100}%`, background: color }}
                  title={`TB: ${p.avgOccupancy} xe`}
                />
              </div>
              <span className="rep-bar-val">{p.avgOccupancy}</span>
              <span className="rep-bar-label">{String(p.hour).padStart(2, "0")}h</span>
            </div>
          );
        })}
      </div>
      <div className="rep-occ-legend">
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#10b981", marginRight: 4 }} />Dưới 60%</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#f59e0b", marginRight: 4 }} />60–85%</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#ef4444", marginRight: 4 }} />Trên 85%</span>
      </div>
    </div>
  );
}

// ─── Top Customers ──────────────────────────────────────────────────────────
interface RepTopCustomersProps {
  data: TopCustomer[];
}

function RepTopCustomers({ data }: RepTopCustomersProps) {
  if (!data.length) {
    return <p className="rep-empty">Chưa có dữ liệu khách hàng.</p>;
  }
  return (
    <div className="rep-customers">
      {data.map((c, i) => (
        <div key={c.userId} className="rep-customer-row">
          <div className="rep-customer-rank" data-rank={i + 1}>{i + 1}</div>
          <div className="rep-customer-avatar">{c.name?.charAt(0).toUpperCase() ?? "?"}</div>
          <div className="rep-customer-info">
            <span className="rep-customer-name">{c.name}</span>
            <span className="rep-customer-sessions">{c.sessionCount} phiên gửi</span>
          </div>
          <div className="rep-customer-spent">
            <strong>{currency.format(c.totalSpent)}</strong>
            <span className="rep-customer-avg">
              TB {c.sessionCount > 0 ? currency.format(Math.round(c.totalSpent / c.sessionCount)) : "—"}/phiên
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Peak Hours Heatmap ─────────────────────────────────────────────────────
const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface RepPeakHoursProps {
  data: PeakHourPoint[];
}

function RepPeakHours({ data }: RepPeakHoursProps) {
  if (!data.length) {
    return <p className="rep-empty">Chưa có dữ liệu giờ cao điểm.</p>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);

  function getIntensity(count: number): string {
    if (max === 0) return "rgba(59,130,246,0.05)";
    const r = count / max;
    if (r > 0.75) return "rgba(239,68,68,0.85)";
    if (r > 0.5) return "rgba(245,158,11,0.75)";
    if (r > 0.25) return "rgba(59,130,246,0.45)";
    if (r > 0) return "rgba(59,130,246,0.2)";
    return "rgba(59,130,246,0.05)";
  }

  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const point of data) {
    const dayIndex = point.dayOfWeek - 1;
    if (dayIndex >= 0 && dayIndex < 7) {
      grid[dayIndex][point.hour] = point.count;
    }
  }

  return (
    <div>
      <div className="rep-heatmap-wrap">
        <div className="rep-heatmap">
          <div className="rep-heatmap-header">
            <div className="rep-heatmap-label" />
            {Array.from({ length: 24 }, (_, h) => (
              <div className="rep-heatmap-hour" key={h}>{h}</div>
            ))}
          </div>
          {grid.map((row, dayIndex) => (
            <div className="rep-heatmap-row" key={dayIndex}>
              <div className="rep-heatmap-label">{DAY_LABELS[dayIndex]}</div>
              {row.map((count, hour) => (
                <div
                  key={hour}
                  className="rep-heatmap-cell"
                  style={{ background: getIntensity(count) }}
                  title={`${DAY_LABELS[dayIndex]} ${hour}h: ${count} xe`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="rep-heatmap-legend">
        <span>Ít</span>
        <div style={{ background: "rgba(59,130,246,0.2)", width: 16, height: 10, borderRadius: 2 }} />
        <div style={{ background: "rgba(59,130,246,0.45)", width: 16, height: 10, borderRadius: 2 }} />
        <div style={{ background: "rgba(245,158,11,0.75)", width: 16, height: 10, borderRadius: 2 }} />
        <div style={{ background: "rgba(239,68,68,0.85)", width: 16, height: 10, borderRadius: 2 }} />
        <span>Nhiều</span>
      </div>
    </div>
  );
}

// ─── Zone Report ────────────────────────────────────────────────────────────
interface ZoneEntry { zone: string; entryCount: number }
interface ZoneExit { zone: string; exitCount: number; revenue: number }

interface RepZoneReportProps {
  entries: ZoneEntry[];
  exits: ZoneExit[];
}

function RepZoneReport({ entries, exits }: RepZoneReportProps) {
  if (!entries.length && !exits.length) {
    return <p className="rep-empty">Chưa có dữ liệu. Nhấn "Tải dữ liệu".</p>;
  }
  const maxEntry = Math.max(...entries.map((e) => e.entryCount), 1);
  const maxExit = Math.max(...exits.map((e) => e.exitCount), 1);

  return (
    <div className="rep-zone-grid">
      <div className="rep-zone-col">
        <h3 className="rep-zone-col-title">
          <ArrowDown size={14} /> Xe vào theo zone
        </h3>
        {entries.map((e) => (
          <div key={e.zone} className="rep-zone-row">
            <span className="rep-zone-name">{e.zone}</span>
            <div className="rep-zone-bar-track">
              <div
                className="rep-zone-bar-fill green"
                style={{ width: `${(e.entryCount / maxEntry) * 100}%` }}
              />
            </div>
            <strong className="rep-zone-num">{e.entryCount}</strong>
          </div>
        ))}
      </div>
      <div className="rep-zone-col">
        <h3 className="rep-zone-col-title">
          <ArrowUp size={14} /> Xe ra theo zone
        </h3>
        {exits.map((e) => (
          <div key={e.zone} className="rep-zone-row">
            <span className="rep-zone-name">{e.zone}</span>
            <div className="rep-zone-bar-track">
              <div
                className="rep-zone-bar-fill blue"
                style={{ width: `${(e.exitCount / maxExit) * 100}%` }}
              />
            </div>
            <strong className="rep-zone-num">{e.exitCount}</strong>
          </div>
        ))}
      </div>
      <div className="rep-zone-revenue">
        <h3 className="rep-zone-col-title">
          <Wallet size={14} /> Doanh thu theo zone
        </h3>
        {exits.map((e) => (
          <div key={e.zone} className="rep-zone-rev-row">
            <span className="rep-zone-name">{e.zone}</span>
            <strong className="rep-zone-rev-amount">{currency.format(e.revenue)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Penalty Report ────────────────────────────────────────────────────────
interface PenaltyData {
  summary: { totalOverdue: number; totalOverdueMinutes: number; avgOverdueMinutes: number };
  topOverdue: Array<{ id: string; plate: string; ownerName: string; slot: string; zone: string; overdueMinutes: number; fee: number }>;
}

interface RepPenaltyReportProps {
  data: PenaltyData | null;
  loading: boolean;
}

function RepPenaltyReport({ data, loading }: RepPenaltyReportProps) {
  if (loading) return <p className="rep-empty">Đang tải...</p>;
  if (!data) return <p className="rep-empty">Chưa có dữ liệu. Nhấn "Tải dữ liệu".</p>;

  return (
    <div>
      <div className="rep-kpi-row">
        <KpiCard
          icon={<ShieldAlert size={16} />}
          label="Tổng phiên quá hạn"
          value={String(data.summary.totalOverdue)}
          color="red"
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="Tổng phút quá hạn"
          value={String(data.summary.totalOverdueMinutes)}
          color="amber"
        />
        <KpiCard
          icon={<Activity size={16} />}
          label="TB phút quá hạn"
          value={String(data.summary.avgOverdueMinutes)}
          sub="mỗi phiên"
          color="purple"
        />
      </div>
      {data.topOverdue.length > 0 ? (
        <div className="rep-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Biển số</th>
                <th>Chủ xe</th>
                <th>Slot</th>
                <th>Zone</th>
                <th>Quá hạn</th>
                <th>Phí</th>
              </tr>
            </thead>
            <tbody>
              {data.topOverdue.map((item) => (
                <tr key={item.id}>
                  <td><strong className="rep-plate">{item.plate}</strong></td>
                  <td>{item.ownerName}</td>
                  <td>{item.slot}</td>
                  <td>{item.zone}</td>
                  <td><span className="rep-badge warn">{item.overdueMinutes} phút</span></td>
                  <td><strong>{currency.format(item.fee)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rep-empty" style={{ marginTop: 16 }}>Không có phiên quá hạn trong khoảng thời gian này.</p>
      )}
    </div>
  );
}

// ─── Main Reports View ──────────────────────────────────────────────────────
type TabKey = "summary" | "revenue" | "occupancy" | "customers" | "peak" | "penalty" | "zones";

export function ReportsView() {
  const { currentUser, reportSummary, reportFrom, setReportFrom, reportTo, setReportTo, loadReportSummary, downloadReport } = useParkingApp();

  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [chartFrom, setChartFrom] = useState(monthAgoStr());
  const [chartTo, setChartTo] = useState(todayStr());
  const [groupBy, setGroupBy] = useState("day");

  // Chart data states
  const [revenueData, setRevenueData] = useState<RevenueChartPoint[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyHourPoint[]>([]);
  const [topCustomersData, setTopCustomersData] = useState<TopCustomer[]>([]);
  const [peakHoursData, setPeakHoursData] = useState<PeakHourPoint[]>([]);
  const [penaltyData, setPenaltyData] = useState<PenaltyData | null>(null);
  const [entryZoneData, setEntryZoneData] = useState<ZoneEntry[]>([]);
  const [exitZoneData, setExitZoneData] = useState<ZoneExit[]>([]);

  const [chartLoading, setChartLoading] = useState(false);

  if (!currentUser || currentUser.role !== "admin") return null;

  async function loadChartData() {
    setChartLoading(true);
    const params = `?from=${chartFrom}&to=${chartTo}`;
    try {
      if (activeTab === "revenue") {
        const res = await apiFetch(`/reports/revenue-chart?from=${chartFrom}&to=${chartTo}&groupBy=${groupBy}`);
        if (res.ok) setRevenueData((await res.json()).data ?? []);
      }
      if (activeTab === "occupancy") {
        const res = await apiFetch(`/reports/occupancy-hourly${params}`);
        if (res.ok) setOccupancyData((await res.json()).data ?? []);
      }
      if (activeTab === "customers") {
        const res = await apiFetch(`/reports/top-customers${params}&limit=10`);
        if (res.ok) setTopCustomersData((await res.json()).data ?? []);
      }
      if (activeTab === "peak") {
        const res = await apiFetch(`/reports/peak-hours${params}`);
        if (res.ok) setPeakHoursData((await res.json()).data ?? []);
      }
      if (activeTab === "penalty") {
        const res = await apiFetch(`/reports/penalty${params}`);
        if (res.ok) setPenaltyData((await res.json()).data ?? null);
      }
      if (activeTab === "zones") {
        const [entryRes, exitRes] = await Promise.all([
          apiFetch(`/reports/entry-by-zone${params}`),
          apiFetch(`/reports/exit-by-zone${params}`),
        ]);
        if (entryRes.ok) setEntryZoneData((await entryRes.json()).data ?? []);
        if (exitRes.ok) setExitZoneData((await exitRes.json()).data ?? []);
      }
    } catch (err) {
      console.error("Load chart error:", err);
    }
    setChartLoading(false);
  }

  // Auto-load on tab change
  useEffect(() => {
    if (activeTab !== "summary") {
      loadChartData();
    }
  }, [activeTab, chartFrom, chartTo, groupBy]);

  // Computed KPIs from reportSummary
  const kpis = useMemo(() => {
    if (!reportSummary) return null;
    return reportSummary;
  }, [reportSummary]);

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "summary", label: "Tổng quan", icon: <BarChart3 size={14} /> },
    { key: "revenue", label: "Doanh thu", icon: <TrendingUp size={14} /> },
    { key: "occupancy", label: "Lấp đầy", icon: <ParkingCircle size={14} /> },
    { key: "customers", label: "Khách hàng", icon: <Users size={14} /> },
    { key: "peak", label: "Giờ cao điểm", icon: <Flame size={14} /> },
    { key: "penalty", label: "Phạt", icon: <ShieldAlert size={14} /> },
    { key: "zones", label: "Theo zone", icon: <MapPin size={14} /> },
  ];

  return (
    <section className="rep-root">
      {/* Header */}
      <div className="rep-header">
        <div className="rep-header-left">
          <div className="rep-title-icon">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="rep-title">Báo cáo & Thống kê</h1>
            <p className="rep-subtitle">Phân tích chi tiết hoạt động bãi đỗ xe</p>
          </div>
        </div>
        <div className="rep-header-right">
          <div className="rep-date-range">
            <Calendar size={14} />
            <span>{chartFrom} → {chartTo}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rep-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`rep-tab${activeTab === tab.key ? " active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <div className="rep-content">
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                />
              </label>
              <label>
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                />
              </label>
            </div>
            <div className="rep-filter-actions">
              <button className="rep-btn primary" onClick={() => loadReportSummary(reportFrom, reportTo)} type="button">
                <Eye size={14} /> Xem báo cáo
              </button>
              <button className="rep-btn" onClick={() => downloadReport("sessions", "xlsx")} type="button">
                <Download size={14} /> Excel
              </button>
              <button className="rep-btn" onClick={() => downloadReport("revenue", "pdf")} type="button">
                <Download size={14} /> PDF
              </button>
            </div>
          </div>

          {kpis && (
            <>
              <div className="rep-kpi-row">
                <KpiCard icon={<ArrowDown size={16} />} label="Xe vào" value={String(kpis.entryCount)} sub="tổng lượt vào" color="blue" />
                <KpiCard icon={<ArrowUp size={16} />} label="Xe ra" value={String(kpis.exitCount)} sub="tổng lượt ra" color="cyan" />
                <KpiCard icon={<Car size={16} />} label="Đang gửi" value={String(kpis.activeCount)} sub="phiên đang hoạt động" color="amber" />
                <KpiCard icon={<Wallet size={16} />} label="Doanh thu" value={currency.format(kpis.revenue)} sub="trong khoảng thời gian" color="green" />
                <KpiCard icon={<Activity size={16} />} label="Phiên miễn phí" value={String(kpis.freeSessionCount)} sub="không tính phí" color="purple" />
                <KpiCard icon={<TrendingUp size={16} />} label="Phiên có phí" value={String(kpis.paidSessionCount)} sub="đã thanh toán" color="blue" />
              </div>
              {kpis.revenue > 0 && kpis.paidSessionCount > 0 && (
                <div className="rep-summary-insight">
                  <TrendingUp size={14} />
                  <span>
                    Doanh thu trung bình mỗi phiên có phí:{" "}
                    <strong>{currency.format(Math.round(kpis.revenue / kpis.paidSessionCount))}</strong>
                  </span>
                </div>
              )}
            </>
          )}

          {!kpis && (
            <div className="rep-empty-state">
              <BarChart3 size={40} />
              <p>Chọn khoảng thời gian và nhấn <strong>"Xem báo cáo"</strong> để bắt đầu</p>
            </div>
          )}
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === "revenue" && (
        <div className="rep-content">
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} />
              </label>
              <label>
                <span>Đến ngày</span>
                <input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} />
              </label>
              <label>
                <span>Nhóm theo</span>
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                  <option value="day">Ngày</option>
                  <option value="week">Tuần</option>
                  <option value="month">Tháng</option>
                </select>
              </label>
            </div>
            <button className="rep-btn primary" onClick={loadChartData} disabled={chartLoading} type="button">
              <RefreshCw size={14} className={chartLoading ? "spin" : ""} />
              {chartLoading ? "Đang tải..." : "Tải dữ liệu"}
            </button>
          </div>
          <RepRevenueChart data={revenueData} groupBy={groupBy} />
        </div>
      )}

      {/* Occupancy Tab */}
      {activeTab === "occupancy" && (
        <div className="rep-content">
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} />
              </label>
              <label>
                <span>Đến ngày</span>
                <input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} />
              </label>
            </div>
            <button className="rep-btn primary" onClick={loadChartData} disabled={chartLoading} type="button">
              <RefreshCw size={14} className={chartLoading ? "spin" : ""} />
              {chartLoading ? "Đang tải..." : "Tải dữ liệu"}
            </button>
          </div>
          <RepOccupancyChart data={occupancyData} />
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === "customers" && (
        <div className="rep-content">
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} />
              </label>
              <label>
                <span>Đến ngày</span>
                <input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} />
              </label>
            </div>
            <button className="rep-btn primary" onClick={loadChartData} disabled={chartLoading} type="button">
              <RefreshCw size={14} className={chartLoading ? "spin" : ""} />
              {chartLoading ? "Đang tải..." : "Tải dữ liệu"}
            </button>
          </div>
          <RepTopCustomers data={topCustomersData} />
        </div>
      )}

      {/* Peak Hours Tab */}
      {activeTab === "peak" && (
        <div className="rep-content">
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} />
              </label>
              <label>
                <span>Đến ngày</span>
                <input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} />
              </label>
            </div>
            <button className="rep-btn primary" onClick={loadChartData} disabled={chartLoading} type="button">
              <RefreshCw size={14} className={chartLoading ? "spin" : ""} />
              {chartLoading ? "Đang tải..." : "Tải dữ liệu"}
            </button>
          </div>
          <RepPeakHours data={peakHoursData} />
        </div>
      )}

      {/* Penalty Tab */}
      {activeTab === "penalty" && (
        <div className="rep-content">
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} />
              </label>
              <label>
                <span>Đến ngày</span>
                <input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} />
              </label>
            </div>
            <button className="rep-btn primary" onClick={loadChartData} disabled={chartLoading} type="button">
              <RefreshCw size={14} className={chartLoading ? "spin" : ""} />
              {chartLoading ? "Đang tải..." : "Tải dữ liệu"}
            </button>
          </div>
          <RepPenaltyReport data={penaltyData} loading={chartLoading} />
        </div>
      )}

      {/* Zones Tab */}
      {activeTab === "zones" && (
        <div className="rep-content">
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} />
              </label>
              <label>
                <span>Đến ngày</span>
                <input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} />
              </label>
            </div>
            <button className="rep-btn primary" onClick={loadChartData} disabled={chartLoading} type="button">
              <RefreshCw size={14} className={chartLoading ? "spin" : ""} />
              {chartLoading ? "Đang tải..." : "Tải dữ liệu"}
            </button>
          </div>
          <RepZoneReport entries={entryZoneData} exits={exitZoneData} />
        </div>
      )}
    </section>
  );
}

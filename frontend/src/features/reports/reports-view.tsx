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
  Download,
  Flame,
  MapPin,
  ParkingCircle,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { logger } from "@/lib/logger";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortCurrency(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return `${value}`;
}

function formatDisplayDate(value: string) {
  if (!value) return "—";
  // Xử lý cả định dạng YYYY-MM-DD lẫn ISO string
  if (value.includes("-")) {
    const parts = value.split("T")[0].split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return value;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getPresetRange(preset: string) {
  const end = todayStr();
  const start = new Date(`${end}T00:00:00`);
  if (preset === "today") return { from: end, to: end };
  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "month") start.setDate(1);
  return { from: toIsoDate(start), to: end };
}

function DateTextInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <input
      aria-label={label}
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/yyyy"
      maxLength={10}
      value={formatDisplayDate(value)}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
        const formatted =
          digits.length > 4
            ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
            : digits.length > 2
              ? `${digits.slice(0, 2)}/${digits.slice(2)}`
              : digits;
        if (formatted.length === 10) {
          const [day, month, year] = formatted.split("/");
          onChange(`${year}-${month}-${day}`);
        } else {
          onChange("");
        }
      }}
    />
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: "blue" | "green" | "amber" | "purple" | "cyan" | "red";
  deltaPct?: number;
}

function KpiCard({ icon, label, value, sub, color, deltaPct }: KpiCardProps) {
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
      <div
        className="rep-kpi-icon"
        style={{ background: c.bg, color: c.color }}
      >
        {icon}
      </div>
      <div className="rep-kpi-body">
        <span className="rep-kpi-label">{label}</span>
        <strong className="rep-kpi-value">{value}</strong>
        {sub && <span className="rep-kpi-sub">{sub}</span>}
        {deltaPct !== undefined && (
          <span
            className="rep-kpi-delta"
            style={{
              color:
                deltaPct > 0
                  ? "#10b981"
                  : deltaPct < 0
                    ? "#ef4444"
                    : "var(--muted)",
            }}
          >
            {deltaPct > 0 ? (
              <TrendingUp size={12} />
            ) : deltaPct < 0 ? (
              <TrendingDown size={12} />
            ) : null}
            {deltaPct > 0 ? "+" : ""}
            {deltaPct}%
            <span
              style={{ color: "var(--muted)", marginLeft: 4, fontWeight: 400 }}
            >
              so với kỳ trước
            </span>
          </span>
        )}
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
    return (
      <p className="rep-empty">
        Chưa có dữ liệu. Chọn khoảng thời gian và nhấn "Tải dữ liệu".
      </p>
    );
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
                title={formatCurrency(p.revenue)}
              />
            </div>
            <span className="rep-bar-val">
              {formatShortCurrency(p.revenue)}
            </span>
            <span className="rep-bar-label">
              {groupBy === "hour" ? `${p.date}h` : p.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
      <div className="rep-chart-table">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Doanh thu</th>
              <th>Số giao dịch</th>
              <th>TB/phiên</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={i}>
                <td>{groupBy === "hour" ? `${p.date}h` : p.date}</td>
                <td>
                  <strong>{formatCurrency(p.revenue)}</strong>
                </td>
                <td>{p.count}</td>
                <td>
                  {p.count > 0
                    ? formatCurrency(Math.round(p.revenue / p.count))
                    : "—"}
                </td>
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
  capacity: number;
  totalSessions: number;
  overallPercentage: number;
}

function RepOccupancyChart({ data, capacity, totalSessions, overallPercentage }: RepOccupancyChartProps) {
  if (!data.length) {
    return (
      <p className="rep-empty">
        Chưa có dữ liệu. Chọn khoảng thời gian và nhấn "Tải dữ liệu".
      </p>
    );
  }
  const chartCapacity = Math.max(capacity, 1);
  const maxOcc = Math.max(...data.map((p) => p.avgOccupancy), 0);
  // Đếm đúng số lượt xe thực tế, không cộng dồn trùng lặp qua 24 giờ
  const displayTotal = totalSessions >= 0 ? totalSessions : 0;
  const calculatedPct = chartCapacity > 0 ? Math.round((displayTotal / chartCapacity) * 100) : 0;

  return (
    <div>
      {/* Thẻ thống kê tổng thể lấp đầy bãi xe */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, margin: "16px 20px 20px 20px" }}>
        <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.18)", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", textTransform: "uppercase" }}>Tổng sức chứa bãi xe</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", marginTop: 4 }}>{chartCapacity} <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>slot</span></div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Quy mô toàn bộ bãi</div>
        </div>

        <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#059669", textTransform: "uppercase" }}>Tổng lượt xe vào gửi</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#059669", marginTop: 4 }}>{displayTotal} <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>lượt xe</span></div>
          <div style={{ fontSize: 12, color: "#059669", marginTop: 4, fontWeight: 500 }}>Trong khoảng thời gian đã chọn</div>
        </div>

        <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", textTransform: "uppercase" }}>Tỷ lệ lấp đầy / hiệu suất</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>{calculatedPct}% <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>công suất</span></div>
          <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4, fontWeight: 500 }}>Chiếm {calculatedPct}% trên tổng số {chartCapacity} slot</div>
        </div>
      </div>

      <div className="rep-chart-area">
        <div className="rep-bar-chart">
          {data.map((p, i) => {
            const avgPct = Math.min(
              100,
              Math.round((p.avgOccupancy / chartCapacity) * 100),
            );
            // Đảm bảo cột có hiển thị tối thiểu để dễ quan sát khi xe ít
            const displayHeight = p.avgOccupancy > 0 ? Math.max(avgPct, 6) : 0;
            const color =
              avgPct >= 85 ? "#ef4444" : avgPct >= 60 ? "#f59e0b" : "#10b981";
            return (
              <div className="rep-bar-col" key={i}>
                <div className="rep-bar-wrap">
                  <div
                    className="rep-bar-fill"
                    style={{
                      height: `${displayHeight}%`,
                      background: color,
                    }}
                    title={`${String(p.hour).padStart(2, "0")}h: TB ${p.avgOccupancy} xe (${avgPct}% sức chứa)`}
                  />
                </div>
                <span className="rep-bar-val" style={{ fontWeight: 600, color: p.avgOccupancy > 0 ? color : undefined, fontSize: 11 }}>
                  {p.avgOccupancy}
                </span>
                <span className="rep-bar-label" style={{ fontSize: 11 }}>
                  {String(p.hour).padStart(2, "0")}:00
                </span>
              </div>
            );
          })}
        </div>
        <div className="rep-occ-legend">
          <span>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "#10b981",
                marginRight: 4,
              }}
            />
            Dưới 60%
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "#f59e0b",
                marginRight: 4,
              }}
            />
            60–85%
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "#ef4444",
                marginRight: 4,
              }}
            />
            Trên 85%
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Top Customers ──────────────────────────────────────────────────────────
interface RepTopCustomersProps {
  data: TopCustomer[];
}

function RepTopCustomers({ data }: { data: any[] }) {
  if (!data.length) {
    return <p className="rep-empty">Chưa có dữ liệu phương tiện gửi xe.</p>;
  }
  return (
    <div className="rep-customers">
      {data.map((c, i) => {
        const isMember = c.customerType === "member";
        const plate = c.plate || c.userId;
        return (
          <div key={plate} className="rep-customer-row">
            <div className="rep-customer-rank" data-rank={i + 1}>
              {i + 1}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                background: isMember ? "rgba(59,130,246,0.12)" : "rgba(100,116,139,0.12)",
                color: isMember ? "#2563eb" : "#475569",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              <Car size={18} />
            </div>
            <div className="rep-customer-info">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: "1.05rem", fontFamily: "monospace", letterSpacing: "0.04em", color: "#0f172a" }}>
                  {plate}
                </strong>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontWeight: 600,
                    background: isMember ? "rgba(37,99,235,0.1)" : "rgba(100,116,139,0.1)",
                    color: isMember ? "#2563eb" : "#475569",
                  }}
                >
                  {isMember ? "Thành viên" : "Vãng lai"}
                </span>
                {c.name && c.name !== "Khách vãng lai" && c.name !== "Thành viên" && (
                  <span style={{ fontSize: 12, color: "var(--muted, #64748b)" }}>({c.name})</span>
                )}
              </div>
              <span className="rep-customer-sessions" style={{ marginTop: 2, display: "block" }}>
                Đã gửi <strong>{c.sessionCount}</strong> phiên
              </span>
            </div>
            <div className="rep-customer-spent">
              <strong>{formatCurrency(c.totalSpent)}</strong>
              <span className="rep-customer-avg">
                TB{" "}
                {c.sessionCount > 0
                  ? formatCurrency(Math.round(c.totalSpent / c.sessionCount))
                  : "—"}
                /phiên
              </span>
            </div>
          </div>
        );
      })}
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
              <div className="rep-heatmap-hour" key={h}>
                {h}
              </div>
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
        <div
          style={{
            background: "rgba(59,130,246,0.2)",
            width: 16,
            height: 10,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            background: "rgba(59,130,246,0.45)",
            width: 16,
            height: 10,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            background: "rgba(245,158,11,0.75)",
            width: 16,
            height: 10,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            background: "rgba(239,68,68,0.85)",
            width: 16,
            height: 10,
            borderRadius: 2,
          }}
        />
        <span>Nhiều</span>
      </div>
    </div>
  );
}

// ─── Zone Report ────────────────────────────────────────────────────────────
interface ZoneEntry {
  zone: string;
  entryCount: number;
}
interface ZoneExit {
  zone: string;
  exitCount: number;
  revenue: number;
}

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
          <ArrowDown size={14} /> Xe vào bãi
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
          <ArrowUp size={14} /> Xe ra bãi
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
          <Wallet size={14} /> Doanh thu bãi xe
        </h3>
        {exits.map((e) => (
          <div key={e.zone} className="rep-zone-rev-row">
            <span className="rep-zone-name">{e.zone}</span>
            <strong className="rep-zone-rev-amount">
              {formatCurrency(e.revenue)}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Reports View ──────────────────────────────────────────────────────
type TabKey =
  | "summary"
  | "revenue"
  | "occupancy"
  | "customers"
  | "peak"
  | "zones";

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
  } = useParkingApp();

  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const initialReportRange = getPresetRange("30d");
  const [chartFrom, setChartFrom] = useState(initialReportRange.from);
  const [chartTo, setChartTo] = useState(initialReportRange.to);
  const [groupBy, setGroupBy] = useState("day");
  const [filterPreset, setFilterPreset] = useState("30d");
  const [filterError, setFilterError] = useState("");
  const [reportDraftFrom, setReportDraftFrom] = useState(reportFrom);
  const [reportDraftTo, setReportDraftTo] = useState(reportTo);

  // Comparison state: previous-period summary for delta indicators
  const [compareSummary, setCompareSummary] = useState<ReportSummary | null>(
    null,
  );
  const [compareLoading, setCompareLoading] = useState(false);

  // Chart data states
  const [revenueData, setRevenueData] = useState<RevenueChartPoint[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyHourPoint[]>([]);
  const [occupancyCapacity, setOccupancyCapacity] = useState(1);
  const [occupancyTotalSessions, setOccupancyTotalSessions] = useState(0);
  const [occupancyOverallPercentage, setOccupancyOverallPercentage] = useState(0);
  const [topCustomersData, setTopCustomersData] = useState<TopCustomer[]>([]);
  const [peakHoursData, setPeakHoursData] = useState<PeakHourPoint[]>([]);
  const [entryZoneData, setEntryZoneData] = useState<ZoneEntry[]>([]);
  const [exitZoneData, setExitZoneData] = useState<ZoneExit[]>([]);

  const [chartLoading, setChartLoading] = useState(false);

  if (!currentUser || currentUser.role !== "admin") return null;

  function shiftDate(dateStr: string, days: number) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // Compute previous-period range (same length, shifted back)
  function previousPeriod(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const lengthMs = toDate.getTime() - fromDate.getTime();
    const prevTo = shiftDate(from, -1);
    const prevFrom = shiftDate(prevTo, -Math.round(lengthMs / 86_400_000));
    return { prevFrom, prevTo };
  }

  async function loadComparison() {
    setCompareLoading(true);
    try {
      const { prevFrom, prevTo } = previousPeriod(reportFrom, reportTo);
      const params = new URLSearchParams({ from: prevFrom, to: prevTo });
      const res = await apiFetch(`/reports/summary?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCompareSummary(data.summary ?? null);
      } else {
        setCompareSummary(null);
      }
    } catch (err) {
      logger.error("Load comparison error:", { err });
      setCompareSummary(null);
    }
    setCompareLoading(false);
  }

  function pctDelta(current: number, previous: number) {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100);
  }

  function applyPreset(preset: string) {
    const range = getPresetRange(preset);
    setChartFrom(range.from);
    setChartTo(range.to);
    setReportDraftFrom(range.from);
    setReportDraftTo(range.to);
    setFilterPreset(preset);
    setFilterError("");

    if (activeTab === "summary") {
      setReportFrom(range.from);
      setReportTo(range.to);
      void loadReportSummary(range.from, range.to);
    }
  }

  function validateDateRange(from: string, to: string) {
    if (!from || !to)
      return "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.";
    if (from > to) return "Ngày bắt đầu không được lớn hơn ngày kết thúc.";
    return "";
  }

  async function loadChartData() {
    const validationError = validateDateRange(chartFrom, chartTo);
    if (validationError) {
      setFilterError(validationError);
      return;
    }
    setFilterError("");
    setChartLoading(true);
    const params = `?from=${chartFrom}&to=${chartTo}`;
    try {
      if (activeTab === "revenue") {
        const res = await apiFetch(
          `/reports/revenue-chart?from=${chartFrom}&to=${chartTo}&groupBy=${groupBy}`,
        );
        if (res.ok) setRevenueData((await res.json()).data ?? []);
      }
      if (activeTab === "occupancy") {
        const [occupancyRes, capacityRes] = await Promise.all([
          apiFetch(`/reports/occupancy-hourly${params}`),
          apiFetch("/capacity-config"),
        ]);
        if (!occupancyRes.ok) {
          const body = await occupancyRes.text();
          throw new Error(
            `Occupancy request failed (${occupancyRes.status}): ${body}`,
          );
        }
        const occupancyJson = await occupancyRes.json();
        setOccupancyData(occupancyJson.data ?? []);
        setOccupancyTotalSessions(occupancyJson.totalSessions ?? 0);
        setOccupancyOverallPercentage(occupancyJson.occupancyPercentage ?? 0);
        if (capacityRes.ok) {
          const capacityJson = await capacityRes.json();
          setOccupancyCapacity(
            Math.max(1, Number(capacityJson.config?.globalCapacity) || Number(occupancyJson.globalCapacity) || 1),
          );
        }
      }
      if (activeTab === "customers") {
        const res = await apiFetch(`/reports/top-customers${params}&limit=10`);
        if (res.ok) setTopCustomersData((await res.json()).data ?? []);
      }
      if (activeTab === "peak") {
        const res = await apiFetch(`/reports/peak-hours${params}`);
        if (res.ok) setPeakHoursData((await res.json()).data ?? []);
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
      logger.error("Load chart error:", { err });
    }
    setChartLoading(false);
  }

  // Auto-load only when switching reports or changing an applied range.
  useEffect(() => {
    if (activeTab !== "summary") {
      loadChartData();
    }
  }, [activeTab, chartFrom, chartTo, groupBy]);

  useEffect(() => {
    setReportDraftFrom(reportFrom);
    setReportDraftTo(reportTo);
  }, [reportFrom, reportTo]);

  const filterSummary = `${formatDisplayDate(chartFrom)} → ${formatDisplayDate(chartTo)}`;

  // Computed KPIs from reportSummary
  const kpis = useMemo(() => {
    if (!reportSummary) return null;
    return reportSummary;
  }, [reportSummary]);

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "summary", label: "Tổng quan", icon: <BarChart3 size={14} /> },
    { key: "revenue", label: "Doanh thu", icon: <TrendingUp size={14} /> },
    { key: "occupancy", label: "Lấp đầy", icon: <ParkingCircle size={14} /> },
    { key: "customers", label: "Khách hàng / Xe", icon: <Users size={14} /> },
    { key: "peak", label: "Giờ cao điểm", icon: <Flame size={14} /> },
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
            <p className="rep-subtitle">
              Phân tích chi tiết hoạt động bãi đỗ xe
            </p>
          </div>
        </div>
        <div className="rep-header-right">
          <div className="rep-date-range">
            <Calendar size={14} />
            <span>
              {formatDisplayDate(
                activeTab === "summary" ? reportFrom : chartFrom,
              )}{" "}
              →{" "}
              {formatDisplayDate(activeTab === "summary" ? reportTo : chartTo)}
            </span>
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
          <div className="rep-filter-panel">
            <div className="rep-filter-heading">
              <div>
                <span className="rep-filter-kicker">BỘ LỌC BÁO CÁO</span>
                <strong>Chọn khoảng thời gian phân tích</strong>
                <small>
                  Dữ liệu hiện tại: {formatDisplayDate(reportFrom)} →{" "}
                  {formatDisplayDate(reportTo)}
                </small>
              </div>
              <Calendar size={20} />
            </div>
            <div
              className="rep-filter-presets"
              role="group"
              aria-label="Khoảng thời gian nhanh"
            >
              {[
                ["today", "Hôm nay"],
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["month", "Tháng này"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filterPreset === key ? "active" : ""}
                  onClick={() => applyPreset(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="rep-filter-bar">
              <div className="rep-date-inputs">
                <label>
                  <span>Từ ngày</span>
                  <DateTextInput
                    label="Ngày bắt đầu báo cáo"
                    value={reportDraftFrom}
                    onChange={(value) => {
                      setReportDraftFrom(value);
                      setFilterPreset("custom");
                    }}
                  />
                </label>
                <span className="rep-filter-arrow">→</span>
                <label>
                  <span>Đến ngày</span>
                  <DateTextInput
                    label="Ngày kết thúc báo cáo"
                    value={reportDraftTo}
                    onChange={(value) => {
                      setReportDraftTo(value);
                      setFilterPreset("custom");
                    }}
                  />
                </label>
              </div>
              <div className="rep-filter-actions">
                <button
                  className="rep-btn"
                  onClick={() => downloadReport("sessions", "xlsx")}
                  type="button"
                >
                  <Download size={14} /> Excel
                </button>
                <button
                  className="rep-btn"
                  onClick={() => downloadReport("revenue", "pdf")}
                  type="button"
                >
                  <Download size={14} /> PDF
                </button>
              </div>
            </div>
            {filterError && (
              <p className="rep-filter-error" role="alert">
                {filterError}
              </p>
            )}
          </div>
          {kpis && (
            <>
              <div className="rep-kpi-row">
                <KpiCard
                  icon={<ArrowDown size={16} />}
                  label="Xe vào"
                  value={String(kpis.entryCount)}
                  sub="tổng lượt vào"
                  color="blue"
                  deltaPct={
                    compareSummary
                      ? pctDelta(kpis.entryCount, compareSummary.entryCount)
                      : undefined
                  }
                />
                <KpiCard
                  icon={<ArrowUp size={16} />}
                  label="Xe ra"
                  value={String(kpis.exitCount)}
                  sub="tổng lượt ra"
                  color="cyan"
                  deltaPct={
                    compareSummary
                      ? pctDelta(kpis.exitCount, compareSummary.exitCount)
                      : undefined
                  }
                />
                <KpiCard
                  icon={<Car size={16} />}
                  label="Đang gửi"
                  value={String(kpis.activeCount)}
                  sub="phiên đang hoạt động"
                  color="amber"
                />
                <KpiCard
                  icon={<Wallet size={16} />}
                  label="Doanh thu"
                  value={formatCurrency(kpis.revenue)}
                  sub="trong khoảng thời gian"
                  color="green"
                  deltaPct={
                    compareSummary
                      ? pctDelta(kpis.revenue, compareSummary.revenue)
                      : undefined
                  }
                />
                <KpiCard
                  icon={<Activity size={16} />}
                  label="Phiên miễn phí"
                  value={String(kpis.freeSessionCount)}
                  sub="không tính phí"
                  color="purple"
                />
                <KpiCard
                  icon={<TrendingUp size={16} />}
                  label="Phiên có phí"
                  value={String(kpis.paidSessionCount)}
                  sub="đã thanh toán"
                  color="blue"
                  deltaPct={
                    compareSummary
                      ? pctDelta(
                          kpis.paidSessionCount,
                          compareSummary.paidSessionCount,
                        )
                      : undefined
                  }
                />
              </div>
              {compareSummary && (
                <div
                  className="rep-summary-insight"
                  style={{
                    background: "rgba(59,130,246,0.08)",
                    borderColor: "rgba(59,130,246,0.2)",
                  }}
                >
                  <BarChart3 size={14} />
                  <span>
                    So sánh với kỳ trước (
                    {previousPeriod(reportFrom, reportTo).prevFrom} →{" "}
                    {previousPeriod(reportFrom, reportTo).prevTo}
                    ): doanh thu{" "}
                    <strong>
                      {pctDelta(kpis.revenue, compareSummary.revenue) > 0
                        ? "+"
                        : ""}
                      {pctDelta(kpis.revenue, compareSummary.revenue)}%
                    </strong>
                    , lượt vào{" "}
                    <strong>
                      {pctDelta(kpis.entryCount, compareSummary.entryCount) > 0
                        ? "+"
                        : ""}
                      {pctDelta(kpis.entryCount, compareSummary.entryCount)}%
                    </strong>
                    .
                  </span>
                </div>
              )}
              {kpis.revenue > 0 && kpis.paidSessionCount > 0 && (
                <div className="rep-summary-insight">
                  <TrendingUp size={14} />
                  <span>
                    Doanh thu trung bình mỗi phiên có phí:{" "}
                    <strong>
                      {formatCurrency(
                        Math.round(kpis.revenue / kpis.paidSessionCount),
                      )}
                    </strong>
                  </span>
                </div>
              )}
            </>
          )}

          {!kpis && (
            <div className="rep-empty-state">
              <BarChart3 size={40} />
              <p>
                Chọn khoảng thời gian và nhấn <strong>"Xem báo cáo"</strong> để
                bắt đầu
              </p>
            </div>
          )}
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === "revenue" && (
        <div className="rep-content">
          <div className="rep-filter-panel compact">
            <div className="rep-filter-heading">
              <div>
                <span className="rep-filter-kicker">BỘ LỌC</span>
                <strong>{filterSummary}</strong>
              </div>
              <Calendar size={18} />
            </div>
            <div
              className="rep-filter-presets"
              role="group"
              aria-label="Khoảng thời gian nhanh"
            >
              {[
                ["today", "Hôm nay"],
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["month", "Tháng này"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filterPreset === key ? "active" : ""}
                  onClick={() => applyPreset(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={chartFrom}
                  onChange={(e) => setChartFrom(e.target.value)}
                />
              </label>
              <label>
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={chartTo}
                  onChange={(e) => setChartTo(e.target.value)}
                />
              </label>
              <label>
                <span>Nhóm theo</span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                >
                  <option value="day">Ngày</option>
                  <option value="week">Tuần</option>
                  <option value="month">Tháng</option>
                </select>
              </label>
            </div>
            <button
              className="rep-btn primary"
              onClick={loadChartData}
              disabled={chartLoading}
              type="button"
            >
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
          <div className="rep-filter-panel compact">
            <div className="rep-filter-heading">
              <div>
                <span className="rep-filter-kicker">BỘ LỌC</span>
                <strong>{filterSummary}</strong>
              </div>
              <Calendar size={18} />
            </div>
            <div
              className="rep-filter-presets"
              role="group"
              aria-label="Khoảng thời gian nhanh"
            >
              {[
                ["today", "Hôm nay"],
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["month", "Tháng này"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filterPreset === key ? "active" : ""}
                  onClick={() => applyPreset(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={chartFrom}
                  onChange={(e) => setChartFrom(e.target.value)}
                />
              </label>
              <label>
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={chartTo}
                  onChange={(e) => setChartTo(e.target.value)}
                />
              </label>
            </div>
            <button
              className="rep-btn primary"
              onClick={loadChartData}
              disabled={chartLoading}
              type="button"
            >
              <RefreshCw size={14} className={chartLoading ? "spin" : ""} />
              {chartLoading ? "Đang tải..." : "Tải dữ liệu"}
            </button>
          </div>
          <RepOccupancyChart
            data={occupancyData}
            capacity={occupancyCapacity}
            totalSessions={occupancyTotalSessions}
            overallPercentage={occupancyOverallPercentage}
          />
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === "customers" && (
        <div className="rep-content">
          <div className="rep-filter-panel compact">
            <div className="rep-filter-heading">
              <div>
                <span className="rep-filter-kicker">BỘ LỌC</span>
                <strong>{filterSummary}</strong>
              </div>
              <Calendar size={18} />
            </div>
            <div
              className="rep-filter-presets"
              role="group"
              aria-label="Khoảng thời gian nhanh"
            >
              {[
                ["today", "Hôm nay"],
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["month", "Tháng này"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filterPreset === key ? "active" : ""}
                  onClick={() => applyPreset(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={chartFrom}
                  onChange={(e) => setChartFrom(e.target.value)}
                />
              </label>
              <label>
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={chartTo}
                  onChange={(e) => setChartTo(e.target.value)}
                />
              </label>
            </div>
            <button
              className="rep-btn primary"
              onClick={loadChartData}
              disabled={chartLoading}
              type="button"
            >
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
          <div className="rep-filter-panel compact">
            <div className="rep-filter-heading">
              <div>
                <span className="rep-filter-kicker">BỘ LỌC</span>
                <strong>{filterSummary}</strong>
              </div>
              <Calendar size={18} />
            </div>
            <div
              className="rep-filter-presets"
              role="group"
              aria-label="Khoảng thời gian nhanh"
            >
              {[
                ["today", "Hôm nay"],
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["month", "Tháng này"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filterPreset === key ? "active" : ""}
                  onClick={() => applyPreset(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={chartFrom}
                  onChange={(e) => setChartFrom(e.target.value)}
                />
              </label>
              <label>
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={chartTo}
                  onChange={(e) => setChartTo(e.target.value)}
                />
              </label>
            </div>
            <button
              className="rep-btn primary"
              onClick={loadChartData}
              disabled={chartLoading}
              type="button"
            >
              <RefreshCw size={14} className={chartLoading ? "spin" : ""} />
              {chartLoading ? "Đang tải..." : "Tải dữ liệu"}
            </button>
          </div>
          <RepPeakHours data={peakHoursData} />
        </div>
      )}

      {/* Zones Tab */}
      {activeTab === "zones" && (
        <div className="rep-content">
          <div className="rep-filter-panel compact">
            <div className="rep-filter-heading">
              <div>
                <span className="rep-filter-kicker">BỘ LỌC</span>
                <strong>{filterSummary}</strong>
              </div>
              <Calendar size={18} />
            </div>
            <div
              className="rep-filter-presets"
              role="group"
              aria-label="Khoảng thời gian nhanh"
            >
              {[
                ["today", "Hôm nay"],
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["month", "Tháng này"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filterPreset === key ? "active" : ""}
                  onClick={() => applyPreset(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rep-filter-bar">
            <div className="rep-date-inputs">
              <label>
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={chartFrom}
                  onChange={(e) => setChartFrom(e.target.value)}
                />
              </label>
              <label>
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={chartTo}
                  onChange={(e) => setChartTo(e.target.value)}
                />
              </label>
            </div>
            <button
              className="rep-btn primary"
              onClick={loadChartData}
              disabled={chartLoading}
              type="button"
            >
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

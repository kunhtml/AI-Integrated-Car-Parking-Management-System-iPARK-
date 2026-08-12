"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calendar,
  Car,
  Check,
  CheckCircle,
  Clock,
  Coffee,
  Crown,
  Edit,
  Eye,
  LogOut,
  Moon,
  ParkingCircle,
  RefreshCw,
  Sun,
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import { useDashboardPolling } from "@/hooks/use-dashboard-polling";
import { currency } from "@/lib/constants";
import type {
  ParkingSession,
  RevenueChartPoint,
  ShiftScheduleItem,
  TopCustomer,
} from "@/types";

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

function getSessionCheckInDate(session: Pick<ParkingSession, "checkIn" | "checkInDate"> & { checkInAt?: string }) {
  if (session.checkInAt) {
    const date = new Date(session.checkInAt);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const [day, month, year] = (session.checkInDate || "").split("/");
  const date = new Date(`${year}-${month}-${day}T${session.checkIn || "00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sessionDateKey(session: Pick<ParkingSession, "checkIn" | "checkInDate"> & { checkInAt?: string }) {
  const date = getSessionCheckInDate(session);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────
type TimeRange = "today" | "7d" | "30d";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: "blue" | "green" | "amber" | "purple" | "red" | "cyan" | "orange";
}

function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  const colors: Record<string, { bg: string; color: string }> = {
    blue: { bg: "rgba(59,130,246,0.08)", color: "#3b82f6" },
    green: { bg: "rgba(16,185,129,0.08)", color: "#10b981" },
    amber: { bg: "rgba(245,158,11,0.08)", color: "#f59e0b" },
    purple: { bg: "rgba(139,92,246,0.08)", color: "#8b5cf6" },
    red: { bg: "rgba(239,68,68,0.08)", color: "#ef4444" },
    cyan: { bg: "rgba(6,182,212,0.08)", color: "#06b6d4" },
    orange: { bg: "rgba(249,115,22,0.08)", color: "#f97316" },
  };
  const c = colors[color];
  return (
    <div className="staff-kpi-card">
      <div className="staff-kpi-icon" style={{ background: c.bg, color: c.color }}>
        {icon}
      </div>
      <div className="staff-kpi-body">
        <span className="staff-kpi-label">{label}</span>
        <strong className="staff-kpi-value">{value}</strong>
        {sub && <span className="staff-kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Shift Schedule Calendar ────────────────────────────────────────────────
const SHIFT_ICONS: Record<string, React.ReactNode> = {
  morning: <Sun size={12} />,
  afternoon: <Sun size={12} />,
  evening: <Moon size={12} />,
  night: <Moon size={12} />,
};
const SHIFT_LABELS: Record<string, string> = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  evening: "Ca tối",
  night: "Ca đêm",
};
const SHIFT_COLORS: Record<string, { bg: string; color: string }> = {
  morning: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" },
  afternoon: { bg: "rgba(249,115,22,0.1)", color: "#f97316" },
  evening: { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6" },
  night: { bg: "rgba(6,182,212,0.1)", color: "#06b6d4" },
};
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  scheduled: { bg: "rgba(148,163,184,0.1)", color: "#64748b" },
  checked_in: { bg: "rgba(16,185,129,0.1)", color: "#10b981" },
  completed: { bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
  cancelled: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
};
const STATUS_LABELS: Record<string, string> = {
  scheduled: "Chưa điểm danh",
  checked_in: "Đang làm",
  completed: "Hoàn thành",
  cancelled: "Hủy",
};

interface ShiftCalendarProps {
  schedules: ShiftScheduleItem[];
  currentUserId: string | undefined;
}

function ShiftCalendar({ schedules, currentUserId }: ShiftCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const mySchedules = useMemo(
    () =>
      schedules.filter(
        (s) =>
          s.staffId === currentUserId ||
          s.staffId === currentUserId,
      ),
    [schedules, currentUserId],
  );

  const calendarDays = useMemo(() => {
    const { year, month } = viewMonth;
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ date: number | null; schedules: ShiftScheduleItem[] }> = [];

    // padding for Sunday start
    for (let i = 0; i < firstDay; i++) days.push({ date: null, schedules: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const daySchedules = mySchedules.filter((s) => s.date === dateStr);
      days.push({ date: d, schedules: daySchedules });
    }
    return days;
  }, [viewMonth, mySchedules]);

  const monthName = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
  });

  const today = todayStr();

  return (
    <div className="staff-shift-cal">
      <div className="staff-shift-cal-nav">
        <button
          onClick={() =>
            setViewMonth((p) => {
              const d = new Date(p.year, p.month - 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })
          }
          type="button"
          className="staff-shift-nav-btn"
        >
          ‹
        </button>
        <span className="staff-shift-month">{monthName}</span>
        <button
          onClick={() =>
            setViewMonth((p) => {
              const d = new Date(p.year, p.month + 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })
          }
          type="button"
          className="staff-shift-nav-btn"
        >
          ›
        </button>
      </div>

      <div className="staff-shift-weekdays">
        {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d) => (
          <div key={d} className="staff-shift-weekday">{d}</div>
        ))}
      </div>

      <div className="staff-shift-grid">
        {calendarDays.map((day, i) => {
          if (!day.date) return <div key={`pad-${i}`} className="staff-shift-cell empty" />;
          const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(day.date).padStart(2, "0")}`;
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              className={`staff-shift-cell${isToday ? " today" : ""}`}
            >
              <span className="staff-shift-day-num">{day.date}</span>
              <div className="staff-shift-events">
                {day.schedules.slice(0, 2).map((s) => (
                  <div
                    key={s.id}
                    className="staff-shift-event"
                    style={{ background: SHIFT_COLORS[s.shiftType]?.bg, color: SHIFT_COLORS[s.shiftType]?.color }}
                    title={`${SHIFT_LABELS[s.shiftType]} (${s.startTime}–${s.endTime}) — ${STATUS_LABELS[s.status]}`}
                  >
                    {SHIFT_ICONS[s.shiftType]}
                    <span>{s.startTime}</span>
                  </div>
                ))}
                {day.schedules.length > 2 && (
                  <div className="staff-shift-more">+{day.schedules.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="staff-shift-legend">
        {Object.entries(SHIFT_LABELS).map(([type, label]) => (
          <div key={type} className="staff-shift-legend-item">
            <div
              className="staff-shift-legend-dot"
              style={{ background: SHIFT_COLORS[type]?.bg, color: SHIFT_COLORS[type]?.color }}
            >
              {SHIFT_ICONS[type]}
            </div>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── My Shifts List ─────────────────────────────────────────────────────────
interface MyShiftsListProps {
  schedules: ShiftScheduleItem[];
  currentUserId: string | undefined;
  currentUserName: string | undefined;
}

function MyShiftsList({ schedules, currentUserId, currentUserName }: MyShiftsListProps) {
  const mySchedules = useMemo(
    () =>
      schedules
        .filter((s) => s.staffId === currentUserId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10),
    [schedules, currentUserId],
  );

  const stats = useMemo(() => {
    const total = mySchedules.length;
    const completed = mySchedules.filter((s) => s.status === "completed").length;
    const checkedIn = mySchedules.filter((s) => s.status === "checked_in").length;
    const scheduled = mySchedules.filter((s) => s.status === "scheduled").length;
    return { total, completed, checkedIn, scheduled };
  }, [mySchedules]);

  const today = todayStr();
  const upcoming = mySchedules.filter((s) => s.date >= today && s.status === "scheduled").slice(0, 3);
  const past = mySchedules.filter((s) => s.date < today || s.status !== "scheduled").slice(0, 5);

  if (!mySchedules.length) {
    return (
      <div className="staff-shifts-empty">
        <Calendar size={28} />
        <p>Chưa có lịch trực nào được phân công.</p>
        <span>Liên hệ quản lý để được xếp ca.</span>
      </div>
    );
  }

  return (
    <div className="staff-shifts-list">
      {/* Stats row */}
      <div className="staff-shifts-stats">
        <div className="staff-shifts-stat">
          <span className="staff-shifts-stat-num">{stats.total}</span>
          <span className="staff-shifts-stat-label">Tổng ca</span>
        </div>
        <div className="staff-shifts-stat done">
          <span className="staff-shifts-stat-num">{stats.completed}</span>
          <span className="staff-shifts-stat-label">Đã hoàn thành</span>
        </div>
        <div className="staff-shifts-stat active">
          <span className="staff-shifts-stat-num">{stats.checkedIn}</span>
          <span className="staff-shifts-stat-label">Đang làm</span>
        </div>
        <div className="staff-shifts-stat pending">
          <span className="staff-shifts-stat-num">{stats.scheduled}</span>
          <span className="staff-shifts-stat-label">Sắp tới</span>
        </div>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <>
          <h3 className="staff-shifts-section-title">
            <Zap size={12} /> Sắp tới
          </h3>
          {upcoming.map((s) => (
            <div key={s.id} className="staff-shift-card upcoming">
              <div
                className="staff-shift-card-icon"
                style={{ background: SHIFT_COLORS[s.shiftType]?.bg, color: SHIFT_COLORS[s.shiftType]?.color }}
              >
                {SHIFT_ICONS[s.shiftType]}
              </div>
              <div className="staff-shift-card-body">
                <strong>{SHIFT_LABELS[s.shiftType]}</strong>
                <span>{s.date} · {s.startTime} – {s.endTime}</span>
              </div>
              <span className="staff-shift-status-badge" style={{ background: STATUS_COLORS[s.status]?.bg, color: STATUS_COLORS[s.status]?.color }}>
                {STATUS_LABELS[s.status]}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Past */}
      {past.length > 0 && (
        <>
          <h3 className="staff-shifts-section-title" style={{ marginTop: 12 }}>
            <Clock size={12} /> Gần đây
          </h3>
          {past.map((s) => (
            <div key={s.id} className="staff-shift-card">
              <div
                className="staff-shift-card-icon"
                style={{ background: SHIFT_COLORS[s.shiftType]?.bg, color: SHIFT_COLORS[s.shiftType]?.color }}
              >
                {SHIFT_ICONS[s.shiftType]}
              </div>
              <div className="staff-shift-card-body">
                <strong>{SHIFT_LABELS[s.shiftType]}</strong>
                <span>{s.date} · {s.startTime} – {s.endTime}</span>
              </div>
              <span className="staff-shift-status-badge" style={{ background: STATUS_COLORS[s.status]?.bg, color: STATUS_COLORS[s.status]?.color }}>
                {STATUS_LABELS[s.status]}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Recent Sessions ─────────────────────────────────────────────────────────
function RecentSessions({ sessions }: { sessions: ParkingSession[] }) {
  const recent = useMemo(
    () =>
      [...sessions]
        .filter((s) => getSessionCheckInDate(s))
        .sort((a, b) => {
          const ta = getSessionCheckInDate(a)?.getTime() ?? 0;
          const tb = getSessionCheckInDate(b)?.getTime() ?? 0;
          return tb - ta;
        })
        .slice(0, 8),
    [sessions],
  );

  if (!recent.length) return <p className="staff-empty">Chưa có phiên gửi xe nào hôm nay.</p>;

  return (
    <div className="staff-session-list">
      {recent.map((s) => (
        <div key={s.id} className="staff-session-row">
          <div className="staff-session-plate">{s.plate}</div>
          <div className="staff-session-info">
            <span>{s.owner}</span>
            <span className="staff-session-slot">{s.slot}</span>
          </div>
          <div className="staff-session-meta">
            {getSessionCheckInDate(s) && (
              <span className="staff-session-time">
                <Clock size={10} />
                {getSessionCheckInDate(s)!.toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <span
              className={`staff-session-badge ${
                s.status === "Đang gửi" ? "active" : s.status === "Đã hoàn thành" ? "done" : "warn"
              }`}
            >
              {s.status === "Đang gửi" && <Activity size={10} />}
              {s.status === "Đã hoàn thành" && <CheckCircle size={10} />}
              {s.status === "Chờ thanh toán" && <XCircle size={10} />}
              {s.status}
            </span>
          </div>
          {s.fee > 0 && <span className="staff-session-fee">{currency.format(s.fee)}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Top Customers (admin view) ──────────────────────────────────────────────
function TopCustomersList({ customers }: { customers: TopCustomer[] }) {
  if (!customers.length) return <p className="staff-empty">Chưa có dữ liệu.</p>;
  return (
    <div className="staff-customers">
      {customers.slice(0, 5).map((c, i) => (
        <div key={i} className="staff-customer-row">
          <div className="staff-customer-rank" data-rank={i + 1}>{i + 1}</div>
          <div className="staff-customer-avatar">{c.name?.charAt(0).toUpperCase() ?? "?"}</div>
          <div className="staff-customer-info">
            <span className="staff-customer-name">{c.name}</span>
            <span className="staff-customer-sessions">Biển số: {c.plate || "—"}</span>
            <span className="staff-customer-sessions">{c.sessionCount} phiên</span>
          </div>
          <strong className="staff-customer-spent">{currency.format(c.totalSpent)}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Activity Feed ──────────────────────────────────────────────────────────
function ActivityFeed({ sessions }: { sessions: ParkingSession[] }) {
  const feed = useMemo(() => {
    return [...sessions]
      .filter((s) => getSessionCheckInDate(s))
      .sort((a, b) => {
        const ta = getSessionCheckInDate(a)?.getTime() ?? 0;
        const tb = getSessionCheckInDate(b)?.getTime() ?? 0;
        return tb - ta;
      })
      .slice(0, 10);
  }, [sessions]);

  if (!feed.length) return <p className="staff-empty">Chưa có hoạt động.</p>;

  return (
    <div className="staff-feed">
      {feed.map((s) => (
        <div key={s.id} className="staff-feed-row">
          <div className={`staff-feed-icon ${s.status === "Đang gửi" ? "entry" : "exit"}`}>
            {s.status === "Đang gửi" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
          </div>
          <div className="staff-feed-info">
            <span>
              <strong>{s.plate}</strong> {s.status === "Đang gửi" ? "vào" : "ra"}
            </span>
            <span className="staff-feed-time">
              {getSessionCheckInDate(s) &&
                getSessionCheckInDate(s)!.toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            </span>
          </div>
          <span className="staff-feed-slot">{s.slot}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Revenue Bar Chart (admin) ───────────────────────────────────────────────
function RevenueBarChart({ data, range }: { data: RevenueChartPoint[]; range: TimeRange }) {
  if (!data.length) return <p className="staff-empty">Chưa có dữ liệu doanh thu.</p>;
  const maxRevenue = Math.max(...data.map((point) => point.revenue), 1);
  const compactNumber = new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return (
    <div className="staff-revenue-chart">
      <h3 className="staff-revenue-chart-title">Doanh thu theo thời gian</h3>
      <div className="staff-revenue-plot">
        <div className="staff-revenue-axis" aria-hidden="true" />
        <div className="staff-revenue-bars">
          {data.map((point, index) => {
            const height = (point.revenue / maxRevenue) * 100;
            return (
              <div className="staff-revenue-bar-column" key={`${point.date}-${index}`}>
                <span className="staff-revenue-value">{compactNumber.format(point.revenue)}</span>
                <div
                  className="staff-revenue-bar"
                  style={{ height: `${height}%` }}
                  title={`${currency.format(point.revenue)} · ${point.count} phiên`}
                />
                <span className="staff-revenue-label">
                  {range === "today" ? `${String(point.date).padStart(2, "0")}h` : point.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Zone Bars (admin) ───────────────────────────────────────────────────────
function ZoneBarChart({
  zones,
}: {
  zones: Array<{ name: string; occupied: number; capacity: number }>;
}) {
  if (!zones.length) return <p className="staff-empty">Không có dữ liệu zone.</p>;
  const maxCap = Math.max(...zones.map((z) => z.capacity), 1);

  return (
    <div className="staff-zone-bars">
      {zones.map((z, i) => {
        const pct = Math.round((z.occupied / z.capacity) * 100);
        const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981";
        return (
          <div key={i} className="staff-zone-row">
            <span className="staff-zone-name">{z.name}</span>
            <div className="staff-zone-track">
              <div className="staff-zone-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="staff-zone-pct" style={{ color }}>
              {pct}%
            </span>
            <span className="staff-zone-cap">
              {z.occupied}/{z.capacity}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── STAFF DASHBOARD ─────────────────────────────────────────────────────────
function StaffDashboard() {
  const {
    currentUser,
    sessions,
    shiftScheduleList,
    zoneList,
    slotList,
    userList,
    registeredVehicles,
  } = useParkingApp();

  // Today's stats
  const todayStats = useMemo(() => {
    const today = todayStr();
    const todaySessions = sessions.filter((s) => {
      const d = sessionDateKey(s);
      return d === today;
    });
    const entryCount = todaySessions.filter((s) => s.status !== "Hủy").length;
    const exitCount = todaySessions.filter((s) => s.status === "Đã hoàn thành").length;
    const activeNow = sessions.filter((s) => s.status === "Đang gửi").length;
    const todayRevenue = todaySessions.reduce((sum, s) => sum + (s.fee || 0), 0);
    const myTodayShifts = shiftScheduleList.filter(
      (s) => s.staffId === currentUser?.id && s.date === today,
    );
    const myActiveShift = myTodayShifts.find((s) => s.status === "checked_in");
    const myUpcomingShift = myTodayShifts.find((s) => s.status === "scheduled");

    return { entryCount, exitCount, activeNow, todayRevenue, myTodayShifts, myActiveShift, myUpcomingShift };
  }, [sessions, shiftScheduleList, currentUser]);

  const totalSlots = slotList.length || 30;
  const freeSlots = slotList.filter((s) => s.status === "empty").length;
  const occupancyPct = totalSlots > 0 ? Math.round(((totalSlots - freeSlots) / totalSlots) * 100) : 0;

  const userName = currentUser?.name || currentUser?.email || "Nhân viên";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Chào buổi sáng";
    if (h < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  })();

  return (
    <section className="staff-root">
      {/* Header */}
      <div className="staff-header">
        <div className="staff-header-left">
          <div className="staff-title-icon staff">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="staff-title">{greeting}, {userName.split(" ").pop()}</h1>
            <p className="staff-subtitle">
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="staff-header-right">
          {/* Current shift badge */}
          {todayStats.myActiveShift && (
            <div className="staff-shift-badge active">
              <Activity size={12} />
              Đang trong ca — {SHIFT_LABELS[todayStats.myActiveShift.shiftType]}
            </div>
          )}
          {todayStats.myUpcomingShift && (
            <div className="staff-shift-badge upcoming">
              <Clock size={12} />
              Ca tiếp — {SHIFT_LABELS[todayStats.myUpcomingShift.shiftType]} lúc {todayStats.myUpcomingShift.startTime}
            </div>
          )}
          {!todayStats.myActiveShift && !todayStats.myUpcomingShift && (
            <div className="staff-shift-badge idle">
              <Coffee size={12} />
              Không có ca hôm nay
            </div>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="staff-kpi-row">
        <StatCard
          icon={<Car size={18} />}
          label="Xe đang gửi"
          value={String(todayStats.activeNow)}
          sub={`/ ${totalSlots} chỗ`}
          color="blue"
        />
        <StatCard
          icon={<ParkingCircle size={18} />}
          label="Chỗ trống"
          value={String(freeSlots)}
          sub={`${occupancyPct}% lấp đầy`}
          color="green"
        />
        <StatCard
          icon={<ArrowDown size={18} />}
          label="Xe vào hôm nay"
          value={String(todayStats.entryCount)}
          sub={`${todayStats.exitCount} xe ra`}
          color="cyan"
        />
        <StatCard
          icon={<Wallet size={18} />}
          label="Doanh thu hôm nay"
          value={currency.format(todayStats.todayRevenue)}
          sub="tổng thu"
          color="amber"
        />
        <StatCard
          icon={<Calendar size={18} />}
          label="Ca trực hôm nay"
          value={String(todayStats.myTodayShifts.length)}
          sub={todayStats.myActiveShift ? "đang làm" : todayStats.myUpcomingShift ? "sắp tới" : "không có ca"}
          color="purple"
        />
        <StatCard
          icon={<CheckCircle size={18} />}
          label="Tổng phiên hôm nay"
          value={String(todayStats.entryCount)}
          sub={`${todayStats.exitCount} đã hoàn thành`}
          color="orange"
        />
      </div>

      {/* Main Content: 3 columns */}
      <div className="staff-main-grid">
        {/* Left: Shift Schedule */}
        <div className="staff-col-main">
          <div className="staff-panel">
            <div className="staff-panel-head">
              <div className="staff-panel-head-left">
                <div className="staff-panel-icon purple">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="staff-panel-kicker">Lịch trực</p>
                  <h2 className="staff-panel-title">Lịch làm việc của tôi</h2>
                </div>
              </div>
            </div>
            <MyShiftsList
              schedules={shiftScheduleList}
              currentUserId={currentUser?.id}
              currentUserName={currentUser?.name}
            />
          </div>
        </div>

        {/* Right: Calendar + Sessions */}
        <div className="staff-col-side">
          {/* Shift Calendar */}
          <div className="staff-panel">
            <div className="staff-panel-head">
              <div className="staff-panel-head-left">
                <div className="staff-panel-icon amber">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="staff-panel-kicker">Tháng</p>
                  <h2 className="staff-panel-title">Lịch trực tháng</h2>
                </div>
              </div>
            </div>
            <ShiftCalendar schedules={shiftScheduleList} currentUserId={currentUser?.id} />
          </div>

          {/* Recent Sessions */}
          <div className="staff-panel">
            <div className="staff-panel-head">
              <div className="staff-panel-head-left">
                <div className="staff-panel-icon blue">
                  <Car size={16} />
                </div>
                <div>
                  <p className="staff-panel-kicker">Phiên gửi xe</p>
                  <h2 className="staff-panel-title">Hoạt động hôm nay</h2>
                </div>
              </div>
              <span className="staff-panel-count">{sessions.filter((s) => sessionDateKey(s) === todayStr()).length}</span>
            </div>
            <RecentSessions sessions={sessions} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDashboard() {
  const {
    stats,
    sessions,
    zoneList,
    slotList,
    userList,
    registeredVehicles,
    setSessions,
    setZoneList,
    setSlotList,
  } = useParkingApp();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [revenueData, setRevenueData] = useState<RevenueChartPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // Real-time polling for admin dashboard
  useDashboardPolling({
    enabled: true,
    intervalMs: 30_000, // Poll every 30 seconds
    onSessionsUpdate: setSessions,
    onZonesUpdate: setZoneList,
    onSlotsUpdate: setSlotList,
  });

  const todayStats = useMemo(() => {
    const today = todayStr();
    const todaySessions = sessions.filter((s) => {
      const d = s.checkIn ? s.checkIn.slice(0, 10) : null;
      return d === today;
    });
    const entryCount = todaySessions.filter((s) => s.status !== "Hủy").length;
    const exitCount = todaySessions.filter((s) => s.status === "Đã hoàn thành").length;
    const todayRevenue = todaySessions.reduce((sum, s) => sum + (s.fee || 0), 0);
    return { entryCount, exitCount, todayRevenue };
  }, [sessions]);

  const zoneOccupancy = useMemo(() => {
    return zoneList.map((z) => {
      const slots = slotList.filter((s) => s.zoneId === z.id);
      const occupied = slots.filter((s) => s.status === "occupied" || s.status === "Đang gửi").length;
      return { name: z.name, occupied, capacity: z.capacity };
    });
  }, [zoneList, slotList]);

  const totalVehicles = registeredVehicles.length;
  const activeSubscriptions = useMemo(
    () => registeredVehicles.filter((v) => v.status === "active" || v.status === "Đang hoạt động").length,
    [registeredVehicles],
  );
  const totalUsers = userList.length;
  const capacity = slotList.length || 30;
  const occupancyPct = capacity > 0 ? Math.round(((capacity - stats.available) / capacity) * 100) : 0;
  const freeSessionCount = sessions.filter((s) => s.fee === 0).length;
  const paidSessionCount = sessions.filter((s) => s.fee > 0).length;

  const topCustomers: TopCustomer[] = useMemo(() => {
    const map = new Map<string, { name: string; plate: string; count: number; spent: number }>();
    sessions.forEach((s) => {
      const name = s.owner || "Khách vãng";
      const plate = s.plate || "Không rõ biển số";
      const key = `${name}:${plate}`;
      const entry = map.get(key) ?? { name, plate, count: 0, spent: 0 };
      entry.count += 1;
      entry.spent += s.fee || 0;
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .map(([userId, entry]) => ({
        userId,
        name: entry.name,
        plate: entry.plate,
        sessionCount: entry.count,
        totalSpent: entry.spent,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);
  }, [sessions]);

  const loadRevenue = async () => {
    setLoading(true);
    try {
      const from = timeRange === "today" ? todayStr() : timeRange === "7d" ? weekAgoStr() : monthAgoStr();
      const to = todayStr();
      const groupBy = timeRange === "today" ? "hour" : "day";
      const res = await apiFetch(`/reports/revenue-chart?from=${from}&to=${to}&groupBy=${groupBy}`);
      if (!res.ok) {
        setRevenueData([]);
      } else {
        const json = await res.json();
        setRevenueData(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setRevenueData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRevenue();
  }, [timeRange]);

  return (
    <section className="staff-root">
      {/* Header */}
      <div className="staff-header">
        <div className="staff-header-left">
          <div className="staff-title-icon admin">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="staff-title">Tổng quan hệ thống</h1>
            <p className="staff-subtitle">
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="staff-header-right">
          <div className="staff-range-tabs">
            {(["today", "7d", "30d"] as TimeRange[]).map((r) => (
              <button
                key={r}
                className={`staff-range-tab${timeRange === r ? " active" : ""}`}
                onClick={() => setTimeRange(r)}
                type="button"
              >
                {r === "today" ? "Hôm nay" : r === "7d" ? "7 ngày" : "30 ngày"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="staff-kpi-row">
        <StatCard icon={<Car size={18} />} label="Xe đang gửi" value={String(stats.active)} sub={`/ ${capacity} chỗ`} color="blue" />
        <StatCard icon={<ParkingCircle size={18} />} label="Chỗ còn trống" value={String(stats.available)} sub={`${occupancyPct}% lấp đầy`} color="green" />
        <StatCard icon={<Wallet size={18} />} label="Doanh thu hôm nay" value={currency.format(todayStats.todayRevenue)} sub={`${paidSessionCount} phiên có phí`} color="amber" />
        <StatCard icon={<Activity size={18} />} label="Xe vào hôm nay" value={String(todayStats.entryCount)} sub={`${todayStats.exitCount} xe ra`} color="cyan" />
        <StatCard icon={<Users size={18} />} label="Khách đăng ký" value={String(totalUsers)} sub={`${activeSubscriptions} xe đang hoạt động`} color="purple" />
        <StatCard icon={<TrendingUp size={18} />} label="Tổng phiên" value={String(stats.completion)} sub={`${freeSessionCount} miễn phí`} color="red" />
      </div>

      {/* Main Charts Row */}
      <div className="staff-charts-row">
        <div className="staff-panel staff-panel-wide">
          <div className="staff-panel-head">
            <div className="staff-panel-head-left">
              <div className="staff-panel-icon blue">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="staff-panel-kicker">Doanh thu</p>
                <h2 className="staff-panel-title">Biểu đồ doanh thu</h2>
              </div>
            </div>
            <button className="staff-refresh-btn" onClick={loadRevenue} disabled={loading} type="button">
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          </div>
          <RevenueBarChart data={revenueData} range={timeRange} />
        </div>

        <div className="staff-panel">
          <div className="staff-panel-head">
            <div className="staff-panel-head-left">
              <div className="staff-panel-icon green">
                <ParkingCircle size={16} />
              </div>
              <div>
                <p className="staff-panel-kicker">Công suất</p>
                <h2 className="staff-panel-title">Lấp đầy theo zone</h2>
              </div>
            </div>
          </div>
          <ZoneBarChart zones={zoneOccupancy} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="staff-bottom-row">
        <div className="staff-panel">
          <div className="staff-panel-head">
            <div className="staff-panel-head-left">
              <div className="staff-panel-icon amber">
                <Car size={16} />
              </div>
              <div>
                <p className="staff-panel-kicker">Phiên gửi xe</p>
                <h2 className="staff-panel-title">Phiên gần đây</h2>
              </div>
            </div>
            <span className="staff-panel-count">{sessions.length}</span>
          </div>
          <RecentSessions sessions={sessions} />
        </div>

        <div className="staff-panel">
          <div className="staff-panel-head">
            <div className="staff-panel-head-left">
              <div className="staff-panel-icon purple">
                <Users size={16} />
              </div>
              <div>
                <p className="staff-panel-kicker">Khách hàng</p>
                <h2 className="staff-panel-title">Top khách hàng</h2>
              </div>
            </div>
          </div>
          <TopCustomersList customers={topCustomers} />
        </div>

        <div className="staff-panel">
          <div className="staff-panel-head">
            <div className="staff-panel-head-left">
              <div className="staff-panel-icon cyan">
                <Clock size={16} />
              </div>
              <div>
                <p className="staff-panel-kicker">Thời gian thực</p>
                <h2 className="staff-panel-title">Hoạt động gần đây</h2>
              </div>
            </div>
          </div>
          <ActivityFeed sessions={sessions} />
        </div>
      </div>
    </section>
  );
}

// ─── Root Export ─────────────────────────────────────────────────────────────
export function OverviewView() {
  const { currentUser } = useParkingApp();

  if (!currentUser) return null;

  if (currentUser.role === "staff") {
    return <StaffDashboard />;
  }

  return <AdminDashboard />;
}

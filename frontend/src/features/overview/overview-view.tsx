"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowRight,
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
import { ShiftDetailModal } from "@/features/shifts/shift-detail-modal";
import { useDashboardPolling } from "@/hooks/use-dashboard-polling";
import { currency } from "@/lib/constants";
import type {
  ParkingSession,
  RevenueChartPoint,
  ShiftScheduleItem,
  TopCustomer,
} from "@/types";

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function todayStr() {
  return dateKey();
}
function weekAgoStr() {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return dateKey(date);
}
function monthAgoStr() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return dateKey(date);
}

// Giống isShiftForToday trong my-schedule-view: ca đêm bắt đầu hôm qua
// nhưng chưa kết thúc vẫn tính là "của hôm nay".
function shiftActiveToday(s: ShiftScheduleItem, today: string): boolean {
  const day = String(s.date).slice(0, 10);
  const start = new Date(`${day}T${s.startTime}`).getTime();
  let end = new Date(`${day}T${s.endTime}`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return day === today;
  if (end <= start) end += 24 * 60 * 60 * 1000;
  const todayStart = new Date(`${today}T00:00:00`).getTime();
  return end > todayStart && start < todayStart + 24 * 60 * 60 * 1000;
}

function getSessionCheckInDate(
  session: Pick<ParkingSession, "checkIn" | "checkInDate"> & {
    checkInAt?: string;
  },
) {
  if (session.checkInAt) {
    const date = new Date(session.checkInAt);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const [day, month, year] = (session.checkInDate || "").split("/");
  const date = new Date(
    `${year}-${month}-${day}T${session.checkIn || "00:00"}`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function sessionDateKey(
  session: Pick<ParkingSession, "checkIn" | "checkInDate"> & {
    checkInAt?: string;
  },
) {
  const date = getSessionCheckInDate(session);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────
type TimeRange = "today" | "7d" | "30d";

type DashboardOverview = {
  active: number;
  activeMember?: number;
  activeGuest?: number;
  available: number;
  capacity: number;
  revenue: number;
  entryCount: number;
  entryMemberCount?: number;
  entryGuestCount?: number;
  exitCount: number;
  exitMemberCount?: number;
  exitGuestCount?: number;
  successfulTransactionCount: number;
  transferRevenue?: number;
  transferCount?: number;
  cashRevenue?: number;
  cashCount?: number;
  freeSessionCount: number;
  customerCount: number;
  registeredVehicleCount: number;
};

const EMPTY_STAFF_SESSIONS: ParkingSession[] = [];

type StaffDashboardOverview = {
  sessions: ParkingSession[];
  entryCount: number;
  exitCount: number;
  activeCount: number;
  revenue: number;
};

interface StatLayer {
  label: string;
  value: string | number;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: "blue" | "green" | "amber" | "purple" | "red" | "cyan" | "orange";
  layers?: StatLayer[];
}

function StatCard({ icon, label, value, sub, color, layers }: StatCardProps) {
  const colors: Record<string, { bg: string; color: string }> = {
    blue: { bg: "rgba(59,130,246,0.08)", color: "#3b82f6" },
    green: { bg: "rgba(16,185,129,0.08)", color: "#10b981" },
    amber: { bg: "rgba(245,158,11,0.08)", color: "#f59e0b" },
    purple: { bg: "rgba(139,92,246,0.08)", color: "#8b5cf6" },
    red: { bg: "rgba(239,68,68,0.08)", color: "#ef4444" },
    cyan: { bg: "rgba(6,182,212,0.08)", color: "#06b6d4" },
    orange: { bg: "rgba(249,115,22,0.08)", color: "#f97316" },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className="staff-kpi-card">
      <div
        className="staff-kpi-icon"
        style={{ background: c.bg, color: c.color }}
      >
        {icon}
      </div>
      <div className="staff-kpi-body">
        <span className="staff-kpi-label">{label}</span>
        <strong className="staff-kpi-value">{value}</strong>
        {sub && <span className="staff-kpi-sub">{sub}</span>}
        {layers && layers.length > 0 && (
          <div className="staff-kpi-layers">
            {layers.map((l, idx) => (
              <div key={idx} className="staff-kpi-layer-item">
                <span className="staff-kpi-layer-label">{l.label}</span>
                <span className="staff-kpi-layer-value">{l.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface KpiGroupProps {
  title: string;
  icon: React.ReactNode;
  tag?: string;
  color?: "blue" | "green" | "amber" | "purple" | "cyan" | "orange";
  className?: string;
  children: React.ReactNode;
}

function KpiGroup({
  title,
  icon,
  tag,
  color = "blue",
  className = "",
  children,
}: KpiGroupProps) {
  const groupColors: Record<string, { bg: string; color: string }> = {
    blue: { bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
    green: { bg: "rgba(16,185,129,0.1)", color: "#10b981" },
    amber: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" },
    purple: { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6" },
    cyan: { bg: "rgba(6,182,212,0.1)", color: "#06b6d4" },
    orange: { bg: "rgba(249,115,22,0.1)", color: "#f97316" },
  };
  const gc = groupColors[color] || groupColors.blue;

  return (
    <div className="staff-kpi-group">
      <div className="staff-kpi-group-header">
        <div className="staff-kpi-group-title-wrap">
          <div
            className="staff-kpi-group-icon"
            style={{ background: gc.bg, color: gc.color }}
          >
            {icon}
          </div>
          <span className="staff-kpi-group-title">{title}</span>
        </div>
        {tag && <span className="staff-kpi-group-tag">{tag}</span>}
      </div>
      <div className={`staff-kpi-group-cards ${className}`}>{children}</div>
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

/** Ngày ca (YYYY-MM-DD) — tránh so sánh với ISO đầy đủ. */
function scheduleDayKey(date: string): string {
  return date.slice(0, 10);
}

/** Ca qua ngày vẫn điểm danh được tới giờ kết thúc thực tế. */
function isShiftCheckInAvailable(
  schedule: ShiftScheduleItem,
  now = new Date(),
): boolean {
  if (schedule.status !== "scheduled") return false;

  const start = new Date(
    `${scheduleDayKey(schedule.date)}T${schedule.startTime}`,
  );
  const end = new Date(`${scheduleDayKey(schedule.date)}T${schedule.endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return false;

  if (end <= start) end.setDate(end.getDate() + 1);
  return now < end;
}

/** Hiển thị thời điểm trên thẻ ca: ưu tiên giờ click điểm danh. */
function formatShiftCardWhen(schedule: ShiftScheduleItem): string {
  if (schedule.checkedInAt) {
    const d = new Date(schedule.checkedInAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
  }
  const d = new Date(schedule.date);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return scheduleDayKey(schedule.date);
}

interface ShiftCalendarProps {
  schedules: ShiftScheduleItem[];
  currentUserId: string | undefined;
}

function ShiftCalendar({ schedules, currentUserId }: ShiftCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [detailSchedule, setDetailSchedule] =
    useState<ShiftScheduleItem | null>(null);

  const mySchedules = useMemo(
    () =>
      schedules.filter(
        (s) => s.staffId === currentUserId || s.staffId === currentUserId,
      ),
    [schedules, currentUserId],
  );

  const calendarDays = useMemo(() => {
    const { year, month } = viewMonth;
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ date: number | null; schedules: ShiftScheduleItem[] }> =
      [];

    // padding for Sunday start
    for (let i = 0; i < firstDay; i++) days.push({ date: null, schedules: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const daySchedules = mySchedules.filter((s) => s.date === dateStr);
      days.push({ date: d, schedules: daySchedules });
    }
    return days;
  }, [viewMonth, mySchedules]);

  const monthName = new Date(
    viewMonth.year,
    viewMonth.month,
    1,
  ).toLocaleDateString("vi-VN", {
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
          <div key={d} className="staff-shift-weekday">
            {d}
          </div>
        ))}
      </div>

      <div className="staff-shift-grid">
        {calendarDays.map((day, i) => {
          if (!day.date)
            return <div key={`pad-${i}`} className="staff-shift-cell empty" />;
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
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setDetailSchedule(s); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailSchedule(s); } }}
                    style={{
                      background: SHIFT_COLORS[s.shiftType]?.bg,
                      color: SHIFT_COLORS[s.shiftType]?.color,
                    }}
                    title={`${SHIFT_LABELS[s.shiftType]} (${s.startTime}–${s.endTime}) — ${STATUS_LABELS[s.status]}`}
                  >
                    {SHIFT_ICONS[s.shiftType]}
                    <span>{s.startTime}</span>
                  </div>
                ))}
                {day.schedules.length > 2 && (
                  <div className="staff-shift-more">
                    +{day.schedules.length - 2}
                  </div>
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
              style={{
                background: SHIFT_COLORS[type]?.bg,
                color: SHIFT_COLORS[type]?.color,
              }}
            >
              {SHIFT_ICONS[type]}
            </div>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {detailSchedule && (
        <ShiftDetailModal
          schedule={detailSchedule}
          onClose={() => setDetailSchedule(null)}
        />
      )}
    </div>
  );
}

// ─── My Shifts List ─────────────────────────────────────────────────────────
interface MyShiftsListProps {
  schedules: ShiftScheduleItem[];
  currentUserId: string | undefined;
  onCheckIn: (scheduleId: string) => Promise<ShiftScheduleItem>;
}

function MyShiftsList({
  schedules,
  currentUserId,
  onCheckIn,
}: MyShiftsListProps) {
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
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
    const completed = mySchedules.filter(
      (s) => s.status === "completed",
    ).length;
    const checkedIn = mySchedules.filter(
      (s) => s.status === "checked_in",
    ).length;
    const scheduled = mySchedules.filter(
      (s) => s.status === "scheduled",
    ).length;
    return { total, completed, checkedIn, scheduled };
  }, [mySchedules]);

  const today = todayStr();
  const upcoming = mySchedules
    .filter((s) => scheduleDayKey(s.date) >= today && s.status === "scheduled")
    .slice(0, 3);
  const past = mySchedules
    .filter((s) => scheduleDayKey(s.date) < today || s.status !== "scheduled")
    .slice(0, 5);

  async function handleCheckIn(scheduleId: string) {
    setCheckingInId(scheduleId);
    try {
      await onCheckIn(scheduleId);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Không thể điểm danh ca.",
      );
    } finally {
      setCheckingInId(null);
    }
  }

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
                style={{
                  background: SHIFT_COLORS[s.shiftType]?.bg,
                  color: SHIFT_COLORS[s.shiftType]?.color,
                }}
              >
                {SHIFT_ICONS[s.shiftType]}
              </div>
              <div className="staff-shift-card-body">
                <strong>{SHIFT_LABELS[s.shiftType]}</strong>
                <span>
                  {formatShiftCardWhen(s)} · {s.startTime} – {s.endTime}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="staff-shift-status-badge"
                  style={{
                    background: STATUS_COLORS[s.status]?.bg,
                    color: STATUS_COLORS[s.status]?.color,
                  }}
                >
                  {STATUS_LABELS[s.status]}
                </span>
                {isShiftCheckInAvailable(s) && (
                  <button
                    type="button"
                    className="small-button primary"
                    disabled={checkingInId === s.id}
                    onClick={() => void handleCheckIn(s.id)}
                  >
                    {checkingInId === s.id
                      ? "Đang điểm danh..."
                      : "Điểm danh ca"}
                  </button>
                )}
              </div>
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
                style={{
                  background: SHIFT_COLORS[s.shiftType]?.bg,
                  color: SHIFT_COLORS[s.shiftType]?.color,
                }}
              >
                {SHIFT_ICONS[s.shiftType]}
              </div>
              <div className="staff-shift-card-body">
                <strong>{SHIFT_LABELS[s.shiftType]}</strong>
                <span>
                  {formatShiftCardWhen(s)} · {s.startTime} – {s.endTime}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="staff-shift-status-badge"
                  style={{
                    background: STATUS_COLORS[s.status]?.bg,
                    color: STATUS_COLORS[s.status]?.color,
                  }}
                >
                  {STATUS_LABELS[s.status]}
                </span>
                {isShiftCheckInAvailable(s) && (
                  <button
                    type="button"
                    className="small-button primary"
                    disabled={checkingInId === s.id}
                    onClick={() => void handleCheckIn(s.id)}
                  >
                    {checkingInId === s.id
                      ? "Đang điểm danh..."
                      : "Điểm danh ca"}
                  </button>
                )}
              </div>
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

  if (!recent.length)
    return <p className="staff-empty">Chưa có phiên gửi xe nào hôm nay.</p>;

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
                s.status === "Đang gửi"
                  ? "active"
                  : s.status === "Đã hoàn thành"
                    ? "done"
                    : "warn"
              }`}
            >
              {s.status === "Đang gửi" && <Activity size={10} />}
              {s.status === "Đã hoàn thành" && <CheckCircle size={10} />}
              {s.status === "Chờ thanh toán" && <XCircle size={10} />}
              {s.status}
            </span>
          </div>
          {s.fee > 0 && (
            <span className="staff-session-fee">{currency.format(s.fee)}</span>
          )}
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
          <div className="staff-customer-rank" data-rank={i + 1}>
            {i + 1}
          </div>
          <div className="staff-customer-avatar">
            {c.name?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="staff-customer-info">
            <span className="staff-customer-name">{c.name}</span>
            <span className="staff-customer-sessions">
              Biển số: {c.plate || "—"}
            </span>
            <span className="staff-customer-sessions">
              {c.sessionCount} phiên
            </span>
          </div>
          <strong className="staff-customer-spent">
            {currency.format(c.totalSpent)}
          </strong>
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
          <div
            className={`staff-feed-icon ${s.status === "Đang gửi" ? "entry" : "exit"}`}
          >
            {s.status === "Đang gửi" ? (
              <ArrowDown size={12} />
            ) : (
              <ArrowUp size={12} />
            )}
          </div>
          <div className="staff-feed-info">
            <span>
              <strong>{s.plate}</strong>{" "}
              {s.status === "Đang gửi" ? "vào" : "ra"}
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
function RevenueBarChart({
  data,
  range,
}: {
  data: RevenueChartPoint[];
  range: TimeRange;
}) {
  if (!data.length)
    return <p className="staff-empty">Chưa có dữ liệu doanh thu.</p>;
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
              <div
                className="staff-revenue-bar-column"
                key={`${point.date}-${index}`}
              >
                <span className="staff-revenue-value">
                  {compactNumber.format(point.revenue)}
                </span>
                <div
                  className="staff-revenue-bar"
                  style={{ height: `${height}%` }}
                  title={`${currency.format(point.revenue)} · ${point.count} phiên`}
                />
                <span className="staff-revenue-label">
                  {range === "today"
                    ? `${String(point.date).padStart(2, "0")}h`
                    : point.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Total Parking Occupancy Bar (admin) ──────────────────────────────────────
function TotalOccupancyBar({
  occupied,
  capacity,
  slots,
}: {
  occupied: number;
  capacity: number;
  slots: Array<{ status: string }>;
}) {
  const cap = capacity > 0 ? capacity : Math.max(slots.length, 1);
  const empty = slots.filter((s) => s.status === "empty").length;
  const inUse = occupied;
  const pct = Math.min(100, Math.round((inUse / cap) * 100));
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981";

  return (
    <div style={{ padding: "16px 20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 12,
        }}
      >
        <div>
          <span style={{ fontSize: "1.75rem", fontWeight: 800, color }}>
            {pct}%
          </span>
          <span
            style={{
              marginLeft: 8,
              fontSize: "0.85rem",
              color: "var(--muted, #64748b)",
            }}
          >
            công suất sử dụng
          </span>
        </div>
        <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
          <span style={{ color }}>{inUse}</span> /{" "}
          <span style={{ color: "var(--text, #1e293b)" }}>{cap}</span> chỗ
        </div>
      </div>

      <div
        style={{
          width: "100%",
          height: 16,
          background: "rgba(0,0,0,0.06)",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 8,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          borderTop: "1px solid var(--border, #e2e8f0)",
          paddingTop: 14,
        }}
      >
        <div
          style={{
            background: "rgba(16, 185, 129, 0.08)",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#059669",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Chỗ còn trống
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 750,
              color: "#059669",
              marginTop: 2,
            }}
          >
            {empty > 0 ? empty : Math.max(0, cap - inUse)} chỗ
          </div>
        </div>
        <div
          style={{
            background: "rgba(59, 130, 246, 0.08)",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(59, 130, 246, 0.2)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#2563eb",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Xe đang đỗ
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 750,
              color: "#2563eb",
              marginTop: 2,
            }}
          >
            {inUse} xe
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── STAFF DASHBOARD ─────────────────────────────────────────────────────────
function StaffDashboard() {
  const {
    currentUser,
    sessions,
    shiftScheduleList,
    checkInShift,
    zoneList,
    slotList,
    userList,
    registeredVehicles,
  } = useParkingApp();
  const [staffOverview, setStaffOverview] =
    useState<StaffDashboardOverview | null>(null);
  const [generalOverview, setGeneralOverview] =
    useState<DashboardOverview | null>(null);
  // "" = hôm nay; khác => ngày cụ thể YYYY-MM-DD để lọc KPI.
  const [filterDate, setFilterDate] = useState("");

  const loadStaffOverview = useCallback(async () => {
    try {
      const response = await apiFetch("/dashboard/staff-overview");
      if (!response.ok) throw new Error("Không thể tải dữ liệu ca làm.");
      const data = await response.json();
      setStaffOverview(data.overview ?? null);
    } catch {
      setStaffOverview(null);
    }
  }, []);

  const loadGeneralOverview = useCallback(async () => {
    try {
      const dateParam = filterDate ? `&date=${filterDate}` : "";
      const response = await apiFetch(`/dashboard/overview?range=today${dateParam}`);
      if (!response.ok) return;
      const data = await response.json();
      setGeneralOverview(data.overview ?? null);
    } catch {
      setGeneralOverview(null);
    }
  }, [filterDate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStaffOverview();
      void loadGeneralOverview();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadStaffOverview, loadGeneralOverview]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadStaffOverview();
      void loadGeneralOverview();
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [loadStaffOverview, loadGeneralOverview]);

  const today = todayStr();

  // Shifts of current staff today
  const myTodayShifts = useMemo(() => {
    return shiftScheduleList.filter(
      (s) =>
        s.staffId === currentUser?.id && shiftActiveToday(s, today),
    );
  }, [shiftScheduleList, currentUser, today]);

  const myCompletedShifts = useMemo(() => {
    return shiftScheduleList.filter(
      (s) => s.staffId === currentUser?.id && s.status === "completed",
    );
  }, [shiftScheduleList, currentUser]);

  const myActiveShift = useMemo(() => {
    return myTodayShifts.find((s) => s.status === "checked_in");
  }, [myTodayShifts]);

  const myUpcomingShift = useMemo(() => {
    return myTodayShifts.find((s) => s.status === "scheduled");
  }, [myTodayShifts]);

  // Real lot-wide metrics (from backend overview or fallback to context)
  // Khi chọn ngày filter, fallback client-side cũng lọc theo ngày đó.
  const statDate = filterDate || today;
  const totalSlots = slotList.length || generalOverview?.capacity || 200;

  const activeCount =
    generalOverview?.active ??
    sessions.filter((s) => s.status === "Đang gửi").length;
  const activeMemberCount =
    generalOverview?.activeMember ??
    sessions.filter(
      (s) =>
        s.status === "Đang gửi" &&
        (s.customerType === "member" ||
          s.isRegisteredMember ||
          s.quotaType === "member"),
    ).length;
  const activeGuestCount =
    generalOverview?.activeGuest ??
    Math.max(0, activeCount - activeMemberCount);
  // ponytail: suy ra chỗ trống từ số xe đang trong bãi để khớp với card
  // "Đang trong bãi"; slot DB sync lag nên không đáng tin. Nâng cấp = backend
  // trả occupancy chuẩn theo session.
  const freeSlots = Math.max(0, totalSlots - activeCount);

  const entryCount =
    generalOverview?.entryCount ??
    sessions
      .filter((s) => s.status !== "Đã hủy" && sessionDateKey(s) === statDate)
      .length;
  const entryMemberCount =
    generalOverview?.entryMemberCount ??
    sessions.filter(
      (s) =>
        s.status !== "Đã hủy" &&
        sessionDateKey(s) === statDate &&
        (s.customerType === "member" ||
          s.isRegisteredMember ||
          s.quotaType === "member"),
    ).length;
  const entryGuestCount =
    generalOverview?.entryGuestCount ??
    Math.max(0, entryCount - entryMemberCount);

  const exitCount =
    generalOverview?.exitCount ??
    sessions.filter(
      (s) => s.status === "Đã hoàn thành" && sessionDateKey(s) === statDate,
    ).length;
  const exitMemberCount =
    generalOverview?.exitMemberCount ??
    sessions.filter(
      (s) =>
        s.status === "Đã hoàn thành" &&
        sessionDateKey(s) === statDate &&
        (s.customerType === "member" ||
          s.isRegisteredMember ||
          s.quotaType === "member"),
    ).length;
  const exitGuestCount =
    generalOverview?.exitGuestCount ?? Math.max(0, exitCount - exitMemberCount);

  const todayRevenue = generalOverview?.revenue ?? 0;
  const successfulTxCount =
    generalOverview?.successfulTransactionCount ?? exitCount;
  const transferRev = generalOverview?.transferRevenue ?? 0;
  const transferCount = generalOverview?.transferCount ?? 0;
  const cashRev = generalOverview?.cashRevenue ?? 0;
  const cashCount = generalOverview?.cashCount ?? 0;

  const userName = currentUser?.name || currentUser?.email || "Nhân viên";
  const statDateLabel = filterDate
    ? new Date(`${filterDate}T00:00:00`).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Hôm nay";
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
            <h1 className="staff-title">
              {greeting}, Nhân viên {userName}
            </h1>
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
          {/* Filter ngày cho KPI lưu lượng & doanh thu */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "#64748b",
            }}
          >
            <Calendar size={14} />
            <input
              type="date"
              value={filterDate || today}
              max={today}
              onChange={(e) => {
                const v = e.target.value;
                setFilterDate(!v || v === today ? "" : v);
              }}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "4px 8px",
                fontSize: 12,
                background: "#fff",
                color: "#334155",
              }}
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate("")}
                style={{
                  border: "none",
                  background: "rgba(59,130,246,0.1)",
                  color: "#2563eb",
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Hôm nay
              </button>
            )}
          </label>
          {/* Current shift badge */}
          {myActiveShift && (
            <div className="staff-shift-badge active">
              <Activity size={12} />
              Đang trong ca — {SHIFT_LABELS[myActiveShift.shiftType]}
            </div>
          )}
          {myUpcomingShift && (
            <div className="staff-shift-badge upcoming">
              <Clock size={12} />
              Ca tiếp — {SHIFT_LABELS[myUpcomingShift.shiftType]} lúc{" "}
              {myUpcomingShift.startTime}
            </div>
          )}
          {!myActiveShift && !myUpcomingShift && (
            <div className="staff-shift-badge idle">
              <Coffee size={12} />
              Không có ca hôm nay
            </div>
          )}
        </div>
      </div>

      {/* 4 Semantic KPI Groups */}
      <div className="staff-kpi-groups">
        {/* Group 1: Lưu lượng phương tiện */}
        <KpiGroup
          title="Lưu lượng phương tiện"
          icon={<Car size={16} />}
          tag={statDateLabel}
          color="cyan"
          className="cards-2"
        >
          <StatCard
            icon={<ArrowDown size={16} />}
            label="Xe vào"
            value={String(entryCount)}
            sub="lượt vào cổng"
            color="cyan"
            layers={[
              { label: "Khách vãng lai", value: entryGuestCount },
              { label: "Khách thành viên", value: entryMemberCount },
            ]}
          />
          <StatCard
            icon={<ArrowUp size={16} />}
            label="Xe ra"
            value={String(exitCount)}
            sub="đã checkout thành công"
            color="orange"
            layers={[
              { label: "Khách vãng lai", value: exitGuestCount },
              { label: "Khách thành viên", value: exitMemberCount },
            ]}
          />
        </KpiGroup>

        {/* Group 2: Vị trí & Sức chứa */}
        <KpiGroup
          title="Vị trí & Sức chứa"
          icon={<ParkingCircle size={16} />}
          tag="Thời gian thực"
          color="green"
        >
          <StatCard
            icon={<ParkingCircle size={16} />}
            label="Tổng vị trí"
            value={String(totalSlots)}
            sub="sức chứa thiết kế"
            color="blue"
          />
          <StatCard
            icon={<CheckCircle size={16} />}
            label="Còn trống"
            value={String(freeSlots)}
            sub="chỗ sẵn sàng"
            color="green"
          />
          <StatCard
            icon={<Activity size={16} />}
            label="Đang trong bãi"
            value={String(activeCount)}
            color="amber"
            layers={[
              { label: "Khách vãng lai", value: activeGuestCount },
              { label: "Khách thành viên", value: activeMemberCount },
            ]}
          />
        </KpiGroup>

        {/* Group 3: Doanh thu & Giao dịch */}
        <KpiGroup
          title="Doanh thu & Giao dịch"
          icon={<Wallet size={16} />}
          tag={statDateLabel}
          color="amber"
          className="cards-4"
        >
          <StatCard
            icon={<Wallet size={16} />}
            label="Doanh thu hôm nay"
            value={currency.format(todayRevenue)}
            sub="tổng thu trong ngày"
            color="amber"
          />
          <StatCard
            icon={<CheckCircle size={16} />}
            label="Tổng giao dịch xong"
            value={String(successfulTxCount)}
            sub="lượt thanh toán"
            color="green"
          />
          <StatCard
            icon={<TrendingUp size={16} />}
            label="Thanh toán chuyển khoản"
            value={currency.format(transferRev)}
            sub={`${transferCount} phiên`}
            color="cyan"
          />
          <StatCard
            icon={<Wallet size={16} />}
            label="Thanh toán tiền mặt"
            value={currency.format(cashRev)}
            sub={`${cashCount} phiên`}
            color="orange"
          />
        </KpiGroup>

        {/* Group 4: Ca trực & Vận hành */}
        <KpiGroup
          title="Ca trực & Vận hành"
          icon={<Calendar size={16} />}
          tag="Hiện tại"
          color="purple"
        >
          <StatCard
            icon={<Calendar size={16} />}
            label="Số ca làm việc hoàn thành"
            value={String(myCompletedShifts.length)}
            sub="toàn bộ"
            color="purple"
          />
          <StatCard
            icon={<Clock size={16} />}
            label="Ca đang làm"
            value={
              myActiveShift
                ? SHIFT_LABELS[myActiveShift.shiftType] || "Đang làm"
                : "Chưa nhận ca"
            }
            sub={
              myActiveShift
                ? `${myActiveShift.startTime} - ${myActiveShift.endTime}`
                : "chờ vào ca"
            }
            color="green"
          />
          <StatCard
            icon={<Sun size={16} />}
            label="Ca tiếp theo"
            value={
              myUpcomingShift
                ? SHIFT_LABELS[myUpcomingShift.shiftType] || "Sắp tới"
                : myTodayShifts.length > 0
                  ? "Hết ca"
                  : "Không có ca"
            }
            sub={
              myUpcomingShift
                ? `bắt đầu lúc ${myUpcomingShift.startTime}`
                : ""
            }
            color="blue"
          />
        </KpiGroup>
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
    setSessions,
    setZoneList,
    setSlotList,
  } = useParkingApp();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  // Real-time polling for admin dashboard
  useDashboardPolling({
    enabled: true,
    intervalMs: 30_000, // Poll every 30 seconds
    onSessionsUpdate: setSessions,
    onZonesUpdate: setZoneList,
    onSlotsUpdate: setSlotList,
  });

  const zoneOccupancy = useMemo(() => {
    return zoneList.map((z) => {
      const slots = slotList.filter((s) => s.zoneId === z.id);
      const occupied = slots.filter((s) => s.status === "occupied").length;
      return { name: z.name, occupied, capacity: z.capacity };
    });
  }, [zoneList, slotList]);

  const capacity = (overview?.capacity ?? slotList.length) || 30;
  const activeCount = overview?.active ?? stats.active;
  const availableCount = overview?.available ?? stats.available;
  const rangeLabel =
    timeRange === "today"
      ? "hôm nay"
      : timeRange === "7d"
        ? "7 ngày"
        : "30 ngày";

  const topCustomers: TopCustomer[] = useMemo(() => {
    const map = new Map<
      string,
      { name: string; plate: string; count: number; spent: number }
    >();
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

  const loadOverview = useCallback(async () => {
    try {
      const response = await apiFetch(`/dashboard/overview?range=${timeRange}`);
      if (!response.ok) return;
      const data = await response.json();
      setOverview(data.overview ?? null);
    } catch {
      setOverview(null);
    }
  }, [timeRange]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOverview();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadOverview]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void loadOverview();
    }, 30_000);

    return () => clearInterval(intervalId);
  }, [loadOverview]);

  return (
    <section className="staff-root">
      {/* Header */}
      <div className="staff-header">
        <div className="staff-header-left">
          <div className="staff-title-icon admin">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="staff-title">Chào Admin đã quay trở lại.</h1>
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

      {/* 4 Semantic KPI Groups */}
      <div className="staff-kpi-groups">
        {/* Group 1: Lưu lượng phương tiện */}
        <KpiGroup
          title="Lưu lượng phương tiện"
          icon={<Car size={16} />}
          tag={rangeLabel}
          color="cyan"
          className="cards-2"
        >
          <StatCard
            icon={<ArrowDown size={16} />}
            label="Xe vào"
            value={String(overview?.entryCount ?? 0)}
            sub="lượt vào cổng"
            color="cyan"
            layers={[
              {
                label: "Khách vãng lai",
                value:
                  overview?.entryGuestCount ??
                  Math.max(
                    0,
                    (overview?.entryCount ?? 0) -
                      (overview?.entryMemberCount ?? 0),
                  ),
              },
              {
                label: "Khách thành viên",
                value: overview?.entryMemberCount ?? 0,
              },
            ]}
          />
          <StatCard
            icon={<ArrowUp size={16} />}
            label="Xe ra"
            value={String(overview?.exitCount ?? 0)}
            sub="đã checkout thành công"
            color="orange"
            layers={[
              {
                label: "Khách vãng lai",
                value:
                  overview?.exitGuestCount ??
                  Math.max(
                    0,
                    (overview?.exitCount ?? 0) -
                      (overview?.exitMemberCount ?? 0),
                  ),
              },
              {
                label: "Khách thành viên",
                value: overview?.exitMemberCount ?? 0,
              },
            ]}
          />
        </KpiGroup>

        {/* Group 2: Vị trí & Sức chứa */}
        <KpiGroup
          title="Vị trí & Sức chứa"
          icon={<ParkingCircle size={16} />}
          tag="Thời gian thực"
          color="green"
        >
          <StatCard
            icon={<ParkingCircle size={16} />}
            label="Tổng vị trí"
            value={String(capacity)}
            sub="sức chứa thiết kế"
            color="blue"
          />
          <StatCard
            icon={<CheckCircle size={16} />}
            label="Còn trống"
            value={String(availableCount)}
            sub="chỗ sẵn sàng"
            color="green"
          />
          <StatCard
            icon={<Activity size={16} />}
            label="Đang trong bãi"
            value={String(activeCount)}
            color="amber"
            layers={[
              {
                label: "Khách vãng lai",
                value:
                  overview?.activeGuest ??
                  Math.max(0, activeCount - (overview?.activeMember ?? 0)),
              },
              {
                label: "Khách thành viên",
                value: overview?.activeMember ?? 0,
              },
            ]}
          />
        </KpiGroup>

        {/* Group 3: Doanh thu & Giao dịch */}
        <KpiGroup
          title="Doanh thu & Giao dịch"
          icon={<Wallet size={16} />}
          tag={rangeLabel}
          color="amber"
          className="cards-4"
        >
          <StatCard
            icon={<Wallet size={16} />}
            label={`Doanh thu ${rangeLabel}`}
            value={currency.format(overview?.revenue ?? 0)}
            sub="tổng thu thực tế"
            color="amber"
          />
          <StatCard
            icon={<CheckCircle size={16} />}
            label="Tổng giao dịch xong"
            value={String(overview?.successfulTransactionCount ?? 0)}
            sub="lượt thanh toán"
            color="green"
          />
          <StatCard
            icon={<TrendingUp size={16} />}
            label="Thanh toán chuyển khoản"
            value={currency.format(overview?.transferRevenue ?? 0)}
            sub={`${overview?.transferCount ?? 0} phiên`}
            color="cyan"
          />
          <StatCard
            icon={<Wallet size={16} />}
            label="Thanh toán tiền mặt"
            value={currency.format(overview?.cashRevenue ?? 0)}
            sub={`${overview?.cashCount ?? 0} phiên`}
            color="orange"
          />
        </KpiGroup>

        {/* Group 4: Khách hàng & Phương tiện */}
        <KpiGroup
          title="Khách hàng & Đăng ký"
          icon={<Users size={16} />}
          tag={rangeLabel}
          color="purple"
        >
          <StatCard
            icon={<Users size={16} />}
            label="Khách đăng ký"
            value={String(overview?.customerCount ?? 0)}
            sub="hồ sơ khách hàng"
            color="purple"
          />
          <StatCard
            icon={<Car size={16} />}
            label="Xe đã đăng ký"
            value={String(overview?.registeredVehicleCount ?? 0)}
            sub="phương tiện trong hệ thống"
            color="cyan"
          />
          <StatCard
            icon={<Activity size={16} />}
            label="Phiên miễn phí"
            value={String(overview?.freeSessionCount ?? 0)}
            sub="vé ưu đãi / 0đ"
            color="blue"
          />
        </KpiGroup>
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

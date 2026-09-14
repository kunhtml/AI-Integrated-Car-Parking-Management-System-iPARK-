"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Activity,
  Car,
  ChevronLeft,
  ChevronRight,
  Zap,
  Coffee,
  ScanLine,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import type { ParkingSession, ShiftScheduleItem } from "@/types";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Ca Sáng",
  afternoon: "Ca Chiều",
  evening: "Ca Tối",
  night: "Ca Đêm",
};

// SVG icon per ca (thay emoji — tuân thủ no-emoji-icons). Dùng trong card (16px).
const SHIFT_ICONS: Record<string, React.ReactNode> = {
  morning: <Sunrise size={16} />,
  afternoon: <Sun size={16} />,
  evening: <Sunset size={16} />,
  night: <Moon size={16} />,
};

const SHIFT_ICON_COMPONENTS: Record<string, LucideIcon> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
};

// Glyph co theo nguyen canh (lich = nho, legend = vua).
function ShiftGlyph({ type, size = 12 }: { type: string; size?: number }) {
  const Icon = SHIFT_ICON_COMPONENTS[type] ?? Calendar;
  return <Icon size={size} strokeWidth={2.2} aria-hidden />;
}

const SHIFT_COLORS: Record<string, { bg: string; color: string }> = {
  morning: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" },
  afternoon: { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" },
  evening: { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6" },
  night: { bg: "rgba(30, 41, 59, 0.12)", color: "#475569" },
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Chờ nhận ca",
  checked_in: "Đang làm",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  missed: "Vắng mặt",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  scheduled: { bg: "rgba(100, 116, 139, 0.1)", color: "#64748b" },
  checked_in: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981" },
  completed: { bg: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" },
  cancelled: { bg: "rgba(239, 68, 68, 0.1)", color: "#ef4444" },
  missed: { bg: "rgba(239, 68, 68, 0.15)", color: "#dc2626" },
};

const KPI_COLORS: Record<string, { bg: string; color: string }> = {
  purple: { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6" },
  green: { bg: "rgba(16,185,129,0.1)", color: "#10b981" },
  blue: { bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
  amber: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" },
};

// KPI card đồng bộ pattern .staff-kpi-card (bên overview) — thay cho class stat-card-* không tồn tại.
function KpiStat({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: keyof typeof KPI_COLORS;
}) {
  const c = KPI_COLORS[color];
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
        <span className="staff-kpi-sub">{sub}</span>
      </div>
    </div>
  );
}

// Một dòng ca trực — dùng chung cho Active / Upcoming / Past để đồng bộ hiển thị.
function ShiftRow({
  s,

  variant,
  checkingInId,
  onCheckIn,
}: {
  s: ShiftScheduleItem;
  variant: "active" | "upcoming" | "";
  checkingInId: string | null;
  onCheckIn: (id: string) => void;
}) {
  const canCheckIn = variant === "upcoming" && isShiftCheckInAvailable(s);
  return (
    <div className={`staff-shift-card${variant ? ` ${variant}` : ""}`}>
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
        {s.location && (
          <span className="staff-shift-card-loc">
            <MapPin size={11} /> {s.location}
          </span>
        )}
      </div>
      <div className="staff-shift-card-actions">
        <span
          className="staff-shift-status-badge"
          style={{
            background: STATUS_COLORS[s.status]?.bg,
            color: STATUS_COLORS[s.status]?.color,
          }}
        >
          {STATUS_LABELS[s.status]}
        </span>
        {canCheckIn && (
          <button
            type="button"
            className="small-button primary"
            disabled={checkingInId === s.id}
            onClick={() => onCheckIn(s.id)}
          >
            {checkingInId === s.id ? "Đang điểm danh..." : "Điểm danh ca"}
          </button>
        )}
      </div>
    </div>
  );
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function scheduleDayKey(dateVal: string | Date): string {
  if (typeof dateVal === "string") {
    return dateVal.slice(0, 10);
  }
  const d = new Date(dateVal);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShiftCardWhen(s: ShiftScheduleItem): string {
  const day = scheduleDayKey(s.date);
  const isToday = day === todayStr();
  const d = new Date(`${day}T12:00:00`);
  const weekday = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("vi-VN", { weekday: "short" });
  if (isToday) return `Hôm nay (${weekday})`;
  return `${weekday}, ${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
}

function isShiftCheckInAvailable(s: ShiftScheduleItem): boolean {
  if (s.status !== "scheduled") return false;
  const day = scheduleDayKey(s.date);
  return day === todayStr();
}

function getSessionCheckInDate(s: ParkingSession): Date | null {
  const raw =
    s.checkInAt ??
    s.checkIn ??
    (s as unknown as { createdAt?: string }).createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Shift Calendar Component ───────────────────────────────────────────────
export interface ShiftCalendarProps {
  schedules: ShiftScheduleItem[];
  currentUserId: string | undefined;
}

export function ShiftCalendar({
  schedules,
  currentUserId,
}: ShiftCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const mySchedules = useMemo(
    () =>
      schedules.filter(
        (s) =>
          currentUserId != null && String(s.staffId) === String(currentUserId),
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
      const daySchedules = mySchedules.filter(
        (s) => scheduleDayKey(s.date) === dateStr,
      );
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
          aria-label="Tháng trước"
        >
          <ChevronLeft size={14} />
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
          aria-label="Tháng tiếp theo"
        >
          <ChevronRight size={14} />
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
                    style={{
                      background: SHIFT_COLORS[s.shiftType]?.bg,
                      color: SHIFT_COLORS[s.shiftType]?.color,
                    }}
                    title={`${SHIFT_LABELS[s.shiftType]} (${s.startTime}–${s.endTime}) — ${STATUS_LABELS[s.status]}`}
                  >
                    <ShiftGlyph type={s.shiftType} size={9} />
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
              <ShiftGlyph type={type} size={11} />
            </div>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── My Shifts List Component ───────────────────────────────────────────────
export interface MyShiftsListProps {
  schedules: ShiftScheduleItem[];
  currentUserId: string | undefined;
  onCheckIn: (scheduleId: string) => Promise<ShiftScheduleItem>;
}

export function MyShiftsList({
  schedules,
  currentUserId,
  onCheckIn,
}: MyShiftsListProps) {
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "upcoming" | "past">(
    "all",
  );

  const allMySchedules = useMemo(
    () =>
      schedules
        .filter(
          (s) =>
            currentUserId != null &&
            String(s.staffId) === String(currentUserId),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [schedules, currentUserId],
  );

  const stats = useMemo(() => {
    const total = allMySchedules.length;
    const completed = allMySchedules.filter(
      (s) => s.status === "completed",
    ).length;
    const checkedIn = allMySchedules.filter(
      (s) => s.status === "checked_in",
    ).length;
    const scheduled = allMySchedules.filter(
      (s) => s.status === "scheduled",
    ).length;
    return { total, completed, checkedIn, scheduled };
  }, [allMySchedules]);

  const today = todayStr();
  const active = allMySchedules.filter((s) => s.status === "checked_in");
  const upcoming = allMySchedules
    .filter(
      (s) =>
        scheduleDayKey(s.date) >= today &&
        s.status === "scheduled" &&
        !active.some((a) => a.id === s.id),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = allMySchedules.filter(
    (s) => s.status !== "checked_in" && !upcoming.some((u) => u.id === s.id),
  );

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

  if (!allMySchedules.length) {
    return (
      <div className="staff-shifts-empty">
        <Calendar size={28} />
        <p>Chưa có lịch trực nào được phân công.</p>
        <span>Liên hệ quản lý để được xếp ca trực.</span>
      </div>
    );
  }

  const showActive = filter === "all" || filter === "active";
  const showUpcoming = filter === "all" || filter === "upcoming";
  const showPast = filter === "all" || filter === "past";

  return (
    <div className="staff-shifts-list">
      {/* Stats row */}
      <div className="staff-shifts-stats">
        <button
          type="button"
          className={`staff-shifts-stat ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
          style={{
            cursor: "pointer",
            border: "none",
            background: "none",
            textAlign: "left",
          }}
        >
          <span className="staff-shifts-stat-num">{stats.total}</span>
          <span className="staff-shifts-stat-label">Tổng ca</span>
        </button>
        <button
          type="button"
          className={`staff-shifts-stat done ${filter === "past" ? "active" : ""}`}
          onClick={() => setFilter("past")}
          style={{
            cursor: "pointer",
            border: "none",
            background: "none",
            textAlign: "left",
          }}
        >
          <span className="staff-shifts-stat-num">{stats.completed}</span>
          <span className="staff-shifts-stat-label">Đã hoàn thành</span>
        </button>
        <button
          type="button"
          className={`staff-shifts-stat active ${filter === "active" ? "active" : ""}`}
          onClick={() => setFilter("active")}
          style={{
            cursor: "pointer",
            border: "none",
            background: "none",
            textAlign: "left",
          }}
        >
          <span className="staff-shifts-stat-num">{stats.checkedIn}</span>
          <span className="staff-shifts-stat-label">Đang làm</span>
        </button>
        <button
          type="button"
          className={`staff-shifts-stat pending ${filter === "upcoming" ? "active" : ""}`}
          onClick={() => setFilter("upcoming")}
          style={{
            cursor: "pointer",
            border: "none",
            background: "none",
            textAlign: "left",
          }}
        >
          <span className="staff-shifts-stat-num">{stats.scheduled}</span>
          <span className="staff-shifts-stat-label">Sắp tới</span>
        </button>
      </div>

      {/* Active Shift */}
      {showActive && active.length > 0 && (
        <>
          <h3 className="staff-shifts-section-title active">
            <Activity size={12} /> Ca đang làm
          </h3>
          {active.map((s) => (
            <ShiftRow
              key={s.id}
              s={s}
              variant="active"
              checkingInId={checkingInId}
              onCheckIn={(id) => void handleCheckIn(id)}
            />
          ))}
        </>
      )}

      {/* Upcoming */}
      {showUpcoming && upcoming.length > 0 && (
        <>
          <h3 className="staff-shifts-section-title">
            <Zap size={12} /> Sắp tới ({upcoming.length})
          </h3>
          {upcoming.slice(0, filter === "upcoming" ? 20 : 5).map((s) => (
            <ShiftRow
              key={s.id}
              s={s}
              variant="upcoming"
              checkingInId={checkingInId}
              onCheckIn={(id) => void handleCheckIn(id)}
            />
          ))}
        </>
      )}

      {/* Past */}
      {showPast && past.length > 0 && (
        <>
          <h3 className="staff-shifts-section-title" style={{ marginTop: 12 }}>
            <Clock size={12} /> Lịch sử ca ({past.length})
          </h3>
          {past.slice(0, filter === "past" ? 30 : 8).map((s) => (
            <ShiftRow
              key={s.id}
              s={s}
              variant=""
              checkingInId={checkingInId}
              onCheckIn={(id) => void handleCheckIn(id)}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Recent Sessions Component ──────────────────────────────────────────────
export function ShiftRecentSessions({
  sessions,
}: {
  sessions: ParkingSession[];
}) {
  const recent = useMemo(
    () =>
      [...sessions]
        .filter((s) => getSessionCheckInDate(s))
        .sort((a, b) => {
          const ta = getSessionCheckInDate(a)?.getTime() ?? 0;
          const tb = getSessionCheckInDate(b)?.getTime() ?? 0;
          return tb - ta;
        })
        .slice(0, 15),
    [sessions],
  );

  if (!recent.length)
    return <p className="staff-empty">Chưa có phiên gửi xe nào hôm nay.</p>;

  return (
    <div className="staff-session-list">
      {recent.map((s) => {
        const inDate = getSessionCheckInDate(s);
        const timeStr = inDate
          ? inDate.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—";
        const isCompleted = s.status === "Đã hoàn thành";
        const fee = s.fee != null ? `${s.fee.toLocaleString("vi-VN")}đ` : "—";

        return (
          <div key={s.id} className="staff-session-row">
            <span className="staff-session-plate">{s.plate}</span>
            <div className="staff-session-info">
              <span>{s.vehicleType || "Xe máy"}</span>
              <span className="staff-session-slot">
                {s.slotId ? `Vị trí ${s.slotId}` : "Chưa gắn vị trí"}
              </span>
            </div>
            <div className="staff-session-meta">
              <span className="staff-session-time">
                <Clock size={10} />
                {timeStr}
              </span>
              {isCompleted && <span className="staff-session-fee">{fee}</span>}
            </div>
            <span
              className={`staff-session-badge ${isCompleted ? "done" : "active"}`}
            >
              {isCompleted ? "Đã xuất" : "Đang đỗ"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Dedicated Work Schedule View ───────────────────────────────────────────
export function MyScheduleView() {
  const { currentUser, shiftScheduleList, checkInShift, sessions } =
    useParkingApp();

  const currentUserId =
    currentUser?.id == null ? undefined : String(currentUser.id);

  const today = todayStr();

  // Personal shifts
  const myTodayShifts = useMemo(() => {
    return shiftScheduleList.filter(
      (s) =>
        currentUserId != null &&
        String(s.staffId) === currentUserId &&
        scheduleDayKey(s.date) === today,
    );
  }, [shiftScheduleList, currentUserId, today]);

  const myActiveShift = useMemo(() => {
    return (
      shiftScheduleList.find(
        (s) =>
          currentUserId != null &&
          String(s.staffId) === currentUserId &&
          s.status === "checked_in",
      ) || null
    );
  }, [shiftScheduleList, currentUserId]);

  const myUpcomingShift = useMemo(() => {
    return (
      myTodayShifts.find(
        (s) =>
          s.status === "scheduled" &&
          (!myActiveShift || s.id !== myActiveShift.id),
      ) || null
    );
  }, [myTodayShifts, myActiveShift]);

  // Today sessions handled by this staff
  const staffSessions = useMemo(() => {
    const today = new Date().toDateString();
    return sessions.filter((s) => {
      const inDate = getSessionCheckInDate(s);
      return inDate && inDate.toDateString() === today;
    });
  }, [sessions]);

  return (
    <div className="staff-root" style={{ gap: 20 }}>
      {/* Status hero — thay banner trùng tiêu đề. Nhấn trạng thái ca hôm nay. */}
      <div className="shift-hero">
        <div className="shift-hero-main">
          <div
            className={`shift-hero-icon ${myActiveShift ? "active" : myUpcomingShift ? "upcoming" : "idle"}`}
          >
            {myActiveShift ? (
              <Activity size={22} />
            ) : myUpcomingShift ? (
              <Clock size={22} />
            ) : (
              <Coffee size={22} />
            )}
          </div>
          <div className="shift-hero-text">
            <p className="shift-hero-kicker">
              Xin chào, {currentUser?.name || currentUser?.email || "nhân viên"}
            </p>
            <h1 className="shift-hero-title">
              {myActiveShift
                ? `Đang trực ${SHIFT_LABELS[myActiveShift.shiftType]}`
                : myUpcomingShift
                  ? `Sắp vào ${SHIFT_LABELS[myUpcomingShift.shiftType]}`
                  : myTodayShifts.length > 0
                    ? "Đã xong ca hôm nay"
                    : "Hôm nay không có ca trực"}
            </h1>
            <p className="shift-hero-sub">
              {myActiveShift
                ? `${myActiveShift.startTime} – ${myActiveShift.endTime}${myActiveShift.location ? ` · ${myActiveShift.location}` : ""}`
                : myUpcomingShift
                  ? `Bắt đầu lúc ${myUpcomingShift.startTime}${myUpcomingShift.location ? ` · ${myUpcomingShift.location}` : ""}`
                  : new Date().toLocaleDateString("vi-VN", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
            </p>
          </div>
        </div>
        <div className="shift-hero-actions">
          {myActiveShift && (
            <span className="shift-hero-chip active">
              <span className="shift-hero-dot" />
              Đang trong ca
            </span>
          )}
          {myUpcomingShift && !myActiveShift && (
            <span className="shift-hero-chip upcoming">
              <Clock size={12} />
              Ca tiếp {myUpcomingShift.startTime}
            </span>
          )}
          <Link
            href="/staff-desk"
            className="small-button primary"
            style={{ textDecoration: "none" }}
          >
            <ScanLine size={14} /> Vào bàn trực
          </Link>
        </div>
      </div>

      {/* KPI Cards — dùng pattern .staff-kpi-card chuẩn */}
      <div className="shift-kpi-grid">
        <KpiStat
          icon={<Calendar size={18} />}
          label="Ca trực hôm nay"
          value={String(myTodayShifts.length)}
          sub="ca được phân công"
          color="purple"
        />
        <KpiStat
          icon={<Zap size={18} />}
          label="Ca đang làm"
          value={
            myActiveShift
              ? SHIFT_LABELS[myActiveShift.shiftType]
              : "Chưa vào ca"
          }
          sub={
            myActiveShift
              ? `${myActiveShift.startTime} – ${myActiveShift.endTime}`
              : "chờ nhận ca"
          }
          color="green"
        />
        <KpiStat
          icon={<Clock size={18} />}
          label="Ca tiếp theo"
          value={
            myUpcomingShift
              ? SHIFT_LABELS[myUpcomingShift.shiftType]
              : myTodayShifts.length > 0
                ? "Hết ca"
                : "Không có ca"
          }
          sub={myUpcomingShift ? `lúc ${myUpcomingShift.startTime}` : "hôm nay"}
          color="blue"
        />
        <KpiStat
          icon={<Car size={18} />}
          label="Phiên trong ca"
          value={String(staffSessions.length)}
          sub="lượt xử lý hôm nay"
          color="amber"
        />
      </div>

      {/* Main layout — 2 cột cân đối: chính = lịch tháng + phiên hôm nay, phụ = danh sách ca (cuộn) */}
      <div className="shift-layout">
        {/* Cột chính */}
        <div className="shift-col shift-col-primary">
          <div className="staff-panel">
            <div className="staff-panel-head">
              <div className="staff-panel-head-left">
                <div className="staff-panel-icon purple">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="staff-panel-kicker">Tháng</p>
                  <h2 className="staff-panel-title">Lịch trực tháng</h2>
                </div>
              </div>
            </div>
            <ShiftCalendar
              schedules={shiftScheduleList}
              currentUserId={currentUserId}
            />
          </div>

          <div className="staff-panel">
            <div className="staff-panel-head">
              <div className="staff-panel-head-left">
                <div className="staff-panel-icon blue">
                  <Car size={16} />
                </div>
                <div>
                  <p className="staff-panel-kicker">Hoạt động</p>
                  <h2 className="staff-panel-title">Ca làm hôm nay</h2>
                </div>
              </div>
              <span className="staff-panel-count">{staffSessions.length}</span>
            </div>
            <ShiftRecentSessions sessions={staffSessions} />
          </div>
        </div>

        {/* Cột phụ */}
        <div className="shift-col shift-col-secondary">
          <div className="staff-panel">
            <div className="staff-panel-head">
              <div className="staff-panel-head-left">
                <div className="staff-panel-icon amber">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="staff-panel-kicker">Lịch trực</p>
                  <h2 className="staff-panel-title">Lịch làm việc của tôi</h2>
                </div>
              </div>
            </div>
            <div className="shift-list-scroll">
              <MyShiftsList
                schedules={shiftScheduleList}
                currentUserId={currentUserId}
                onCheckIn={checkInShift}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

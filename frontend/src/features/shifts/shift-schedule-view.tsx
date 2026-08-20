"use client";

import { useState, useEffect, useMemo } from "react";
import { CalendarDays, Clock3, Users, Plus, Trash2, Edit2, CheckCircle, XCircle, ChevronLeft, ChevronRight, User, Calendar, BarChart3, Download } from "lucide-react";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch } from "@/lib/client-api";
import type { ShiftScheduleItem, ShiftType, StaffForSchedule } from "@/types";

const SHIFT_COLORS: Record<string, string> = {
  morning: "#f59e0b",
  afternoon: "#3b82f6",
  evening: "#8b5cf6",
  night: "#1e293b",
};

const SHIFT_LABELS: Record<string, string> = {
  morning: "Ca Sáng",
  afternoon: "Ca Chiều",
  evening: "Ca Tối",
  night: "Ca Đêm",
};

const DAYS_OF_WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function ShiftScheduleView() {
  const { currentUser, shiftScheduleList, actionLog, loadSchedules, loadMySchedule, createSchedule, deleteSchedule, checkInShift, completeShiftSchedule } = useParkingApp();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffs, setStaffs] = useState<StaffForSchedule[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null);
  const [preselectedShiftType, setPreselectedShiftType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"schedule" | "stats">("schedule");

  // Stats state
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth() + 1);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [staffStats, setStaffStats] = useState<StaffStats[]>([]);
  const [statsTotals, setStatsTotals] = useState<{ total: number; completed: number; checkedIn: number; scheduled: number; cancelled: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  interface StaffStats {
    staffId: string;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    total: number;
    completed: number;
    checkedIn: number;
    scheduled: number;
    cancelled: number;
  }

  const isAdmin = currentUser?.role === "admin";

  // Load shift types
  useEffect(() => {
    async function loadTypes() {
      try {
        const res = await apiFetch("/shift-schedules/types");
        const data = await res.json();
        if (res.ok) setShiftTypes(data.shiftTypes);
      } catch { /* ignore */ }
    }
    loadTypes();
  }, []);

  // Load staff list for admin
  useEffect(() => {
    if (!isAdmin) return;
    async function loadStaffs() {
      try {
        const res = await apiFetch("/shift-schedules/staffs");
        const data = await res.json();
        if (res.ok) setStaffs(data.staffs);
      } catch { /* ignore */ }
    }
    loadStaffs();
  }, [isAdmin]);

  // Load schedules
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const weekDates = getWeekDates(currentDate);
      const fromDate = formatDate(weekDates[0]);
      const toDate = formatDate(weekDates[6]);
      if (isAdmin) {
        await loadSchedules({ fromDate, toDate, staffId: selectedStaffId || undefined });
      } else {
        await loadMySchedule({ fromDate, toDate });
      }
      setIsLoading(false);
    }
    load();
  }, [currentDate, selectedStaffId, isAdmin, loadSchedules, loadMySchedule]);

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  // Group schedules by date and shift type
  const schedulesByDateAndShift = useMemo(() => {
    const map: Record<string, ShiftScheduleItem[]> = {};
    for (const date of weekDates) {
      for (const shiftType of ["morning", "afternoon", "evening", "night"]) {
        const key = `${formatDate(date)}_${shiftType}`;
        map[key] = [];
      }
    }
    for (const schedule of shiftScheduleList) {
      const scheduleDate = new Date(schedule.date);
      const key = `${formatDate(scheduleDate)}_${schedule.shiftType}`;
      if (map[key]) {
        map[key].push(schedule);
      }
    }
    return map;
  }, [shiftScheduleList, weekDates]);

  function prevWeek() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  }

  function nextWeek() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  // Load stats when tab is stats
  useEffect(() => {
    if (activeTab !== "stats" || !isAdmin) return;
    async function loadStats() {
      setStatsLoading(true);
      try {
        const res = await apiFetch(`/shift-schedules/stats?month=${statsMonth}&year=${statsYear}`);
        const data = await res.json();
        if (res.ok) {
          setStaffStats(data.stats);
          setStatsTotals(data.totals);
        }
      } catch { /* ignore */ }
      setStatsLoading(false);
    }
    loadStats();
  }, [activeTab, statsMonth, statsYear, isAdmin]);

  function prevStatsMonth() {
    if (statsMonth === 1) {
      setStatsMonth(12);
      setStatsYear(statsYear - 1);
    } else {
      setStatsMonth(statsMonth - 1);
    }
  }

  function nextStatsMonth() {
    if (statsMonth === 12) {
      setStatsMonth(1);
      setStatsYear(statsYear + 1);
    } else {
      setStatsMonth(statsMonth + 1);
    }
  }

  function handleCellClick(date: Date, shiftType: string) {
    if (!isAdmin) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (d < today) return; // Don't allow adding past shifts
    setPreselectedDate(formatDate(date));
    setPreselectedShiftType(shiftType);
    setShowAddModal(true);
  }

  async function handleCheckIn(id: string) {
    try {
      await checkInShift(id);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleComplete(id: string) {
    try {
      await completeShiftSchedule(id);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xóa lịch ca này?")) return;
    await deleteSchedule(id);
  }

  // Export CSV functions
  function exportScheduleCSV() {
    const headers = ["Ngày", "Ca", "Nhân viên", "Email", "SĐT", "Giờ bắt đầu", "Giờ kết thúc", "Trạng thái", "Ghi chú"];

    const rows = shiftScheduleList.map((schedule) => {
      const date = new Date(schedule.date);
      const formattedDate = date.toLocaleDateString("vi-VN");
      const shiftLabel = SHIFT_LABELS[schedule.shiftType] || schedule.shiftType;
      const startTime = shiftTypes.find((t) => t.key === schedule.shiftType)?.startTime || "";
      const endTime = shiftTypes.find((t) => t.key === schedule.shiftType)?.endTime || "";
      const statusLabel =
        schedule.status === "scheduled"
          ? "Chưa điểm danh"
          : schedule.status === "checked_in"
          ? "Đã điểm danh"
          : schedule.status === "completed"
          ? "Hoàn thành"
          : schedule.status === "cancelled"
          ? "Đã hủy"
          : schedule.status;

      return [
        formattedDate,
        shiftLabel,
        schedule.staffName || "",
        schedule.staffEmail || "",
        schedule.staffPhone || "",
        startTime,
        endTime,
        statusLabel,
        schedule.note || "",
      ];
    });

    const csvContent =
      "\uFEFF" + // BOM for UTF-8
      [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join(
        "\n"
      );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const weekStr = weekDates[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) + "-" + weekDates[6].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    link.setAttribute("download", `lich-lam-viec-${weekStr}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportStatsCSV() {
    if (!statsTotals || staffStats.length === 0) {
      alert("Không có dữ liệu để xuất");
      return;
    }

    const headers = ["STT", "Nhân viên", "Email", "SĐT", "Tổng ca", "Hoàn thành", "Đã check-in", "Chờ", "Hủy"];

    const rows = staffStats.map((staff, index) => [
      index + 1,
      staff.name,
      staff.email,
      staff.phone || "",
      staff.total,
      staff.completed,
      staff.checkedIn,
      staff.scheduled,
      staff.cancelled,
    ]);

    // Add summary row
    rows.push([]);
    rows.push(["", "TỔNG CỘNG", "", "", statsTotals.total, statsTotals.completed, statsTotals.checkedIn, statsTotals.scheduled, statsTotals.cancelled]);

    const csvContent =
      "\uFEFF" + // BOM for UTF-8
      [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join(
        "\n"
      );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `thong-ke-ca-lam-viec-${statsMonth}-${statsYear}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Nhân viên</p>
            <h2>Lịch làm việc</h2>
          </div>
          <div className="inline-actions">
            {isAdmin && (
              <>
                <button
                  className={`small-button ${activeTab === "stats" ? "primary" : ""}`}
                  onClick={() => setActiveTab("stats")}
                  type="button"
                >
                  <BarChart3 size={14} /> Thống kê
                </button>
                <button
                  className={`small-button ${activeTab === "schedule" ? "primary" : ""}`}
                  onClick={() => setActiveTab("schedule")}
                  type="button"
                >
                  <Calendar size={14} /> Lịch
                </button>
                <button className="small-button" onClick={() => setShowBulkModal(true)} type="button">
                  <Calendar size={14} /> Gán tuần
                </button>
                <button className="small-button" onClick={() => setShowMonthModal(true)} type="button">
                  <CalendarDays size={14} /> Gán tháng
                </button>
                <button className="small-button" onClick={() => { setPreselectedDate(null); setPreselectedShiftType(null); setShowAddModal(true); }} type="button">
                  <Plus size={14} /> Gán ca
                </button>
                <button className="small-button" onClick={() => setShowExportModal(true)} type="button">
                  <Download size={14} /> Xuất CSV
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats Tab */}
        {activeTab === "stats" && isAdmin && (
          <div style={{ padding: "0 0 16px 0" }}>
            {/* Stats month navigation */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button className="small-button" onClick={prevStatsMonth} type="button">
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontWeight: 500, minWidth: 120, textAlign: "center" }}>
                Tháng {statsMonth}/{statsYear}
              </span>
              <button className="small-button" onClick={nextStatsMonth} type="button">
                <ChevronRight size={16} />
              </button>
            </div>

            {statsLoading ? (
              <p className="muted-cell">Đang tải...</p>
            ) : (
              <>
                {/* Summary cards */}
                {statsTotals && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 20 }}>
                    <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>{statsTotals.total}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Tổng cộng</div>
                    </div>
                    <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e" }}>{statsTotals.completed}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Hoàn thành</div>
                    </div>
                    <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{statsTotals.checkedIn}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Đã check-in</div>
                    </div>
                    <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{statsTotals.scheduled}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Chờ</div>
                    </div>
                    <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>{statsTotals.cancelled}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Hủy</div>
                    </div>
                  </div>
                )}

                {/* Staff list table */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)" }}>
                        <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>Nhân viên</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid var(--border)" }}>Tổng</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid var(--border)", color: "#22c55e" }}>Hoàn thành</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid var(--border)", color: "#3b82f6" }}>Check-in</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid var(--border)", color: "#f59e0b" }}>Chờ</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid var(--border)", color: "#ef4444" }}>Hủy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffStats.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                            Không có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        staffStats.map((staff) => (
                          <tr key={staff.staffId} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{
                                  width: 32, height: 32, borderRadius: "50%",
                                  background: "var(--primary)", color: "white",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 12, fontWeight: 600
                                }}>
                                  {staff.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500 }}>{staff.name}</div>
                                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{staff.email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}>{staff.total}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", color: "#22c55e", fontWeight: 500 }}>{staff.completed}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", color: "#3b82f6", fontWeight: 500 }}>{staff.checkedIn}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", color: "#f59e0b", fontWeight: 500 }}>{staff.scheduled}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", color: "#ef4444", fontWeight: 500 }}>{staff.cancelled}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Export button for stats */}
                {staffStats.length > 0 && (
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                    <button className="small-button" onClick={exportStatsCSV} type="button">
                      <Download size={14} /> Xuất CSV thống kê
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === "schedule" && (
          <>
            {/* Week navigation */}
            <div className="filter-row" style={{ marginBottom: 16 }}>
              <button className="small-button" onClick={prevWeek} type="button">
                <ChevronLeft size={16} />
              </button>
              <button className="small-button" onClick={goToToday} type="button">
                Hôm nay
              </button>
              <button className="small-button" onClick={nextWeek} type="button">
                <ChevronRight size={16} />
              </button>
              <span style={{ marginLeft: 12, fontWeight: 500 }}>
                {weekDates[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} —{" "}
                {weekDates[6].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </span>
              {isAdmin && (
                <select
                  value={selectedStaffId || ""}
                  onChange={(e) => setSelectedStaffId(e.target.value || null)}
                  style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                >
                  <option value="">Tất cả nhân viên</option>
                  {staffs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {isLoading && <p className="muted-cell">Đang tải...</p>}

            {actionLog && <p className="muted-cell" style={{ marginBottom: 12, color: "var(--success)" }}>{actionLog}</p>}

            {/* Week view - Timetable style */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid var(--border)", background: "var(--bg-secondary)", width: 120 }}>Ca</th>
                    {weekDates.map((date, i) => (
                      <th
                        key={i}
                        style={{
                          padding: 12,
                          textAlign: "center",
                          borderBottom: "2px solid var(--border)",
                          background: isSameDay(date, new Date()) ? "rgba(37, 99, 235, 0.1)" : "var(--bg-secondary)",
                          color: isSameDay(date, new Date()) ? "var(--primary)" : "inherit",
                          fontWeight: isSameDay(date, new Date()) ? 700 : 400,
                        }}
                      >
                        <div>{DAYS_OF_WEEK[i]}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{date.getDate()}/{date.getMonth() + 1}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["morning", "afternoon", "evening", "night"].map((shiftType) => (
                    <tr key={shiftType}>
                      <td style={{ padding: 12, borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: SHIFT_COLORS[shiftType],
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 500 }}>{SHIFT_LABELS[shiftType]}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {shiftTypes.find((t) => t.key === shiftType)?.startTime || "—"} —{" "}
                              {shiftTypes.find((t) => t.key === shiftType)?.endTime || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      {weekDates.map((date, i) => {
                        const cellKey = `${formatDate(date)}_${shiftType}`;
                        const cellSchedules = schedulesByDateAndShift[cellKey] || [];
                        return (
                          <td
                            key={i}
                            style={{
                              padding: 4,
                              borderBottom: "1px solid var(--border)",
                              borderLeft: "1px solid var(--border)",
                              minHeight: 90,
                              overflowWrap: "anywhere",
                              verticalAlign: "top",
                              background: isSameDay(date, new Date()) ? "rgba(37, 99, 235, 0.05)" : "transparent",
                              cursor: isAdmin && date >= new Date(new Date().setHours(0,0,0,0)) ? "pointer" : "default",
                            }}
                            onClick={() => handleCellClick(date, shiftType)}
                          >
                            {cellSchedules.length === 0 ? (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 82 }}>
                                {isAdmin && date >= new Date(new Date().setHours(0,0,0,0)) && (
                                  <div style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "center", padding: 8, border: "1px dashed var(--border)", borderRadius: 6, width: "100%" }}>
                                    <Plus size={14} style={{ marginBottom: 2 }} />
                                    <div>Click để gán</div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {cellSchedules.map((schedule) => (
                                  <div
                                    key={schedule.id}
                                    style={{
                                      padding: "6px 8px",
                                      borderRadius: 6,
                                      background: SHIFT_COLORS[schedule.shiftType] + "25",
                                      borderLeft: `3px solid ${SHIFT_COLORS[schedule.shiftType]}`,
                                      fontSize: 12,
                                      position: "relative",
                                    }}
                                  >
                                    <div style={{ fontWeight: 500, marginBottom: 2 }}>
                                      {schedule.staffName || "NV"}
                                    </div>
                                    {schedule.staffPhone && (
                                      <div style={{ fontSize: 10, opacity: 0.7 }}>{schedule.staffPhone}</div>
                                    )}
                                    <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                      <span
                                        className={`badge ${
                                          schedule.status === "scheduled"
                                            ? "warning"
                                            : schedule.status === "checked_in"
                                            ? "info"
                                            : schedule.status === "completed"
                                            ? "success"
                                            : "muted"
                                        }`}
                                        style={{ fontSize: 10 }}
                                      >
                                        {schedule.status === "scheduled"
                                          ? "Chưa điểm danh"
                                          : schedule.status === "checked_in"
                                          ? "Đã điểm danh"
                                          : schedule.status === "completed"
                                          ? "Hoàn thành"
                                          : "Đã hủy"}
                                      </span>
                                    </div>
                                    <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                                      {schedule.status === "scheduled" && (
                                        <button
                                          className="small-button"
                                          style={{ fontSize: 10, padding: "2px 6px" }}
                                          onClick={(e) => { e.stopPropagation(); handleCheckIn(schedule.id); }}
                                          type="button"
                                        >
                                          Điểm danh
                                        </button>
                                      )}
                                      {schedule.status === "checked_in" && (
                                        <button
                                          className="small-button"
                                          style={{ fontSize: 10, padding: "2px 6px", background: "var(--success)", color: "white" }}
                                          onClick={(e) => { e.stopPropagation(); handleComplete(schedule.id); }}
                                          type="button"
                                        >
                                          Hoàn thành
                                        </button>
                                      )}
                                      {isAdmin && (
                                        <button
                                          className="small-button"
                                          style={{ fontSize: 10, padding: "2px 6px", color: "var(--danger)" }}
                                          onClick={(e) => { e.stopPropagation(); handleDelete(schedule.id); }}
                                          type="button"
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
              {Object.entries(SHIFT_LABELS).map(([key, label]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: SHIFT_COLORS[key] }} />
                  <span style={{ fontSize: 12 }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Export button for schedule */}
            {shiftScheduleList.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <button className="small-button" onClick={exportScheduleCSV} type="button">
                  <Download size={14} /> Xuất CSV lịch tuần
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Schedule Modal */}
      {showAddModal && (
        <AddScheduleModal
          staffs={staffs}
          shiftTypes={shiftTypes}
          defaultDate={preselectedDate || formatDate(weekDates[0])}
          defaultShiftType={preselectedShiftType as "morning" | "afternoon" | "evening" | "night" || "morning"}
          onClose={() => { setShowAddModal(false); setPreselectedDate(null); setPreselectedShiftType(null); }}
          onAdd={async (data) => {
            try {
              await createSchedule(data);
              setShowAddModal(false);
              setPreselectedDate(null);
              setPreselectedShiftType(null);
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}

      {/* Bulk Assign Modal */}
      {showBulkModal && isAdmin && (
        <BulkAssignModal
          staffs={staffs}
          shiftTypes={shiftTypes}
          weekDates={weekDates}
          onClose={() => setShowBulkModal(false)}
          onAdd={async (data) => {
            try {
              await createSchedule(data);
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}

      {/* Month Assign Modal */}
      {showMonthModal && isAdmin && (
        <MonthAssignModal
          staffs={staffs}
          shiftTypes={shiftTypes}
          onClose={() => setShowMonthModal(false)}
          onAdd={async (data) => {
            try {
              for (const item of data) {
                await createSchedule(item);
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}

      {/* Export CSV Modal */}
      {showExportModal && isAdmin && (
        <ExportCSVModal
          onClose={() => setShowExportModal(false)}
          onExport={async (fromDate, toDate, staffId) => {
            try {
              const res = await apiFetch(`/shift-schedules?fromDate=${fromDate}&toDate=${toDate}${staffId ? `&staffId=${staffId}` : ""}`);
              const data = await res.json();
              if (res.ok && data.schedules) {
                exportCSVByData(data.schedules, fromDate, toDate);
                setShowExportModal(false);
              }
            } catch (e) {
              console.error(e);
              alert("Có lỗi khi xuất dữ liệu");
            }
          }}
          staffs={staffs}
        />
      )}
    </section>
  );
}

// Add Schedule Modal Component
function AddScheduleModal({
  staffs,
  shiftTypes,
  defaultDate,
  defaultShiftType,
  onClose,
  onAdd,
}: {
  staffs: StaffForSchedule[];
  shiftTypes: ShiftType[];
  defaultDate: string;
  defaultShiftType: "morning" | "afternoon" | "evening" | "night";
  onClose: () => void;
  onAdd: (data: {
    staffId: string;
    date: string;
    shiftType: "morning" | "afternoon" | "evening" | "night";
    startTime: string;
    endTime: string;
    note?: string;
  }) => Promise<void>;
}) {
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [shiftType, setShiftType] = useState<"morning" | "afternoon" | "evening" | "night">(defaultShiftType);
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("14:00");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateError, setDateError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const type = shiftTypes.find((t) => t.key === shiftType);
    if (type) {
      setStartTime(type.startTime);
      setEndTime(type.endTime);
    }
  }, [shiftType, shiftTypes]);

  function handleDateChange(value: string) {
    setDate(value);
    if (value < today) {
      setDateError("Không được gán ca cho ngày đã qua");
    } else {
      setDateError("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) {
      alert("Vui lòng chọn nhân viên");
      return;
    }
    if (date < today) {
      setDateError("Không được gán ca cho ngày đã qua");
      return;
    }
    setIsSubmitting(true);
    try {
      await onAdd({ staffId, date, shiftType, startTime, endTime, note: note || undefined });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: 12,
          padding: 24,
          width: "90%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3>Gán ca làm việc</h3>
          <button className="small-button" onClick={onClose} type="button">
            <XCircle size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            Nhân viên *
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
              <option value="">— Chọn nhân viên —</option>
              {staffs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </label>

          <label>
            Ngày *
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => handleDateChange(e.target.value)}
              required
              style={{ borderColor: dateError ? "var(--danger)" : undefined }}
            />
            {dateError && <span style={{ color: "var(--danger)", fontSize: 12 }}>{dateError}</span>}
          </label>

          <label>
            Ca làm việc *
            <select value={shiftType} onChange={(e) => setShiftType(e.target.value as typeof shiftType)} required>
              {shiftTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} ({t.startTime} — {t.endTime})
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Giờ bắt đầu
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label>
              Giờ kết thúc
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>

          <label>
            Ghi chú
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Ca đặc biệt, ca cuối tuần..."
              rows={2}
            />
          </label>

          <div className="inline-actions" style={{ marginTop: 8 }}>
            <button className="full-button" type="submit" disabled={isSubmitting || !!dateError}>
              {isSubmitting ? "Đang lưu..." : "Gán ca"}
            </button>
            <button className="small-button" onClick={onClose} type="button">
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Bulk Assign Modal - Assign shifts for entire week
function BulkAssignModal({
  staffs,
  shiftTypes,
  weekDates,
  onClose,
  onAdd,
}: {
  staffs: StaffForSchedule[];
  shiftTypes: ShiftType[];
  weekDates: Date[];
  onClose: () => void;
  onAdd: (data: {
    staffId: string;
    date: string;
    shiftType: "morning" | "afternoon" | "evening" | "night";
    startTime: string;
    endTime: string;
    note?: string;
  }) => Promise<void>;
}) {
  const [staffId, setStaffId] = useState("");
  const [shiftType, setShiftType] = useState<"morning" | "afternoon" | "evening" | "night">("morning");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("14:00");
  const [note, setNote] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter week dates to only include today and future
  const futureWeekDates = weekDates.filter((date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d >= today;
  });

  // Get indices of future dates
  const futureIndices = futureWeekDates.map((futureDate) => {
    return weekDates.findIndex((d) => d.toDateString() === futureDate.toDateString());
  });

  useEffect(() => {
    const type = shiftTypes.find((t) => t.key === shiftType);
    if (type) {
      setStartTime(type.startTime);
      setEndTime(type.endTime);
    }
  }, [shiftType, shiftTypes]);

  function toggleDay(index: number) {
    const futureDate = weekDates[index];
    const d = new Date(futureDate);
    d.setHours(0, 0, 0, 0);
    if (d < today) return; // Prevent selecting past dates

    setSelectedDays((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) {
      alert("Vui lòng chọn nhân viên");
      return;
    }
    if (selectedDays.length === 0) {
      alert("Vui lòng chọn ít nhất một ngày");
      return;
    }
    setIsSubmitting(true);
    try {
      for (const dayIndex of selectedDays) {
        const date = formatDate(weekDates[dayIndex]);
        await onAdd({ staffId, date, shiftType, startTime, endTime, note: note || undefined });
      }
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: 12,
          padding: 24,
          width: "90%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3>Gán ca hàng tuần</h3>
          <button className="small-button" onClick={onClose} type="button">
            <XCircle size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            Nhân viên *
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
              <option value="">— Chọn nhân viên —</option>
              {staffs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </label>

          <label>
            Chọn ngày trong tuần *
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {weekDates.map((date, i) => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                const isPast = d < today;
                const isSelected = selectedDays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    disabled={isPast}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: `1px solid ${isPast ? "var(--border)" : isSelected ? "var(--primary)" : "var(--border)"}`,
                      background: isSelected ? "var(--primary)" : isPast ? "var(--bg-secondary)" : "transparent",
                      color: isSelected ? "white" : isPast ? "var(--muted)" : "inherit",
                      cursor: isPast ? "not-allowed" : "pointer",
                      fontSize: 12,
                      opacity: isPast ? 0.5 : 1,
                    }}
                  >
                    {DAYS_OF_WEEK[i]}
                    <br />
                    <span style={{ fontSize: 10 }}>{date.getDate()}/{date.getMonth() + 1}</span>
                    {isPast && <div style={{ fontSize: 9, marginTop: 2 }}>Đã qua</div>}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
              Chỉ hiển thị ngày từ hôm nay trở đi
            </span>
          </label>

          <label>
            Ca làm việc *
            <select value={shiftType} onChange={(e) => setShiftType(e.target.value as typeof shiftType)} required>
              {shiftTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} ({t.startTime} — {t.endTime})
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Giờ bắt đầu
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label>
              Giờ kết thúc
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>

          <label>
            Ghi chú
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Áp dụng cho tuần này..."
              rows={2}
            />
          </label>

          <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 8, marginTop: 8 }}>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Tổng cộng:</strong> {selectedDays.length} ngày × 1 ca = <strong>{selectedDays.length} lịch</strong>
            </p>
          </div>

          <div className="inline-actions" style={{ marginTop: 8 }}>
            <button className="full-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : `Gán ${selectedDays.length} ca`}
            </button>
            <button className="small-button" onClick={onClose} type="button">
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper function to export CSV from data
function exportCSVByData(schedules: ShiftScheduleItem[], fromDate: string, toDate: string) {
  const headers = ["STT", "Ngày", "Ca", "Nhân viên", "Email", "SĐT", "Giờ bắt đầu", "Giờ kết thúc", "Trạng thái", "Ghi chú"];

  const SHIFT_LABELS_LOCAL: Record<string, string> = {
    morning: "Ca Sáng",
    afternoon: "Ca Chiều",
    evening: "Ca Tối",
    night: "Ca Đêm",
  };

  const rows = schedules.map((schedule, index) => {
    const date = new Date(schedule.date);
    const formattedDate = date.toLocaleDateString("vi-VN");
    const shiftLabel = SHIFT_LABELS_LOCAL[schedule.shiftType] || schedule.shiftType;
    const statusLabel =
      schedule.status === "scheduled"
        ? "Chưa điểm danh"
        : schedule.status === "checked_in"
        ? "Đã điểm danh"
        : schedule.status === "completed"
        ? "Hoàn thành"
        : schedule.status === "cancelled"
        ? "Đã hủy"
        : schedule.status;

    return [
      index + 1,
      formattedDate,
      shiftLabel,
      schedule.staffName || "",
      schedule.staffEmail || "",
      schedule.staffPhone || "",
      "",
      "",
      statusLabel,
      schedule.note || "",
    ];
  });

  const csvContent =
    "\uFEFF" + // BOM for UTF-8
    [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `lich-lam-viec-${fromDate}-den-${toDate}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export CSV Modal Component
function ExportCSVModal({
  onClose,
  onExport,
  staffs,
}: {
  onClose: () => void;
  onExport: (fromDate: string, toDate: string, staffId: string | null) => Promise<void>;
  staffs: StaffForSchedule[];
}) {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (!fromDate || !toDate) {
      alert("Vui lòng chọn ngày bắt đầu và ngày kết thúc");
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      alert("Ngày bắt đầu phải trước ngày kết thúc");
      return;
    }
    setIsExporting(true);
    try {
      await onExport(fromDate, toDate, selectedStaffId || null);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: 12,
          padding: 24,
          width: "90%",
          maxWidth: 420,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3>Xuất báo cáo lịch làm việc</h3>
          <button className="small-button" onClick={onClose} type="button">
            <XCircle size={18} />
          </button>
        </div>

        <div className="stack-form">
          <label>
            Từ ngày *
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>

          <label>
            Đến ngày *
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>

          <label>
            Nhân viên (để trống = tất cả)
            <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
              <option value="">— Tất cả nhân viên —</option>
              {staffs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </label>

          <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Xuất file CSV chứa danh sách lịch làm việc trong khoảng thời gian đã chọn. File có thể mở bằng Excel hoặc Google Sheets.
            </p>
          </div>

          <div className="inline-actions" style={{ marginTop: 8 }}>
            <button className="full-button" onClick={handleExport} disabled={isExporting} type="button">
              {isExporting ? "Đang xuất..." : "Xuất CSV"}
            </button>
            <button className="small-button" onClick={onClose} type="button">
              Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Month Assign Modal - Assign shifts for entire month
function MonthAssignModal({
  staffs,
  shiftTypes,
  onClose,
  onAdd,
}: {
  staffs: StaffForSchedule[];
  shiftTypes: ShiftType[];
  onClose: () => void;
  onAdd: (data: Array<{
    staffId: string;
    date: string;
    shiftType: "morning" | "afternoon" | "evening" | "night";
    startTime: string;
    endTime: string;
    note?: string;
  }>) => Promise<void>;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [staffId, setStaffId] = useState("");
  const [shiftType, setShiftType] = useState<"morning" | "afternoon" | "evening" | "night">("morning");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("14:00");
  const [note, setNote] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Days of week labels (T2-CN)
  const DAYS_OF_WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  // Get days in month
  const daysInMonth = new Date(year, month, 0).getDate();

  // Generate days of the month
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Get day of week for 1st of month (0=Sun, convert to 1=Mon... 7=Sun)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  // Convert: Sunday=0 -> 6 (CN), Monday=1 -> 0 (T2), etc.
  const firstDayIndex = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if a day is in the past
  function isPastDay(day: number): boolean {
    const d = new Date(year, month - 1, day);
    d.setHours(0, 0, 0, 0);
    return d < today;
  }

  // Check if a day is weekend (T7=5, CN=6)
  function isWeekend(day: number): boolean {
    const d = new Date(year, month - 1, day);
    return d.getDay() === 0 || d.getDay() === 6;
  }

  // Check if a day is selected
  function isDaySelected(day: number): boolean {
    return selectedDays.includes(day);
  }

  // Toggle day selection
  function toggleDay(day: number) {
    if (isPastDay(day)) return;
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  // Select all weekdays (Mon-Fri)
  function selectWeekdays() {
    const weekdays = monthDays.filter((d) => !isWeekend(d) && !isPastDay(d));
    setSelectedDays(weekdays);
  }

  // Select all weekends (Sat-Sun)
  function selectWeekends() {
    const weekends = monthDays.filter((d) => isWeekend(d) && !isPastDay(d));
    setSelectedDays(weekends);
  }

  // Select all non-past days
  function selectAll() {
    const all = monthDays.filter((d) => !isPastDay(d));
    setSelectedDays(all);
  }

  // Clear all selections
  function clearAll() {
    setSelectedDays([]);
  }

  useEffect(() => {
    const type = shiftTypes.find((t) => t.key === shiftType);
    if (type) {
      setStartTime(type.startTime);
      setEndTime(type.endTime);
    }
  }, [shiftType, shiftTypes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) {
      alert("Vui lòng chọn nhân viên");
      return;
    }
    if (selectedDays.length === 0) {
      alert("Vui lòng chọn ít nhất một ngày");
      return;
    }
    setIsSubmitting(true);
    try {
      const schedules = selectedDays
        .sort((a, b) => a - b)
        .map((day) => ({
          staffId,
          date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          shiftType,
          startTime,
          endTime,
          note: note || undefined,
        }));
      await onAdd(schedules);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  }

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
    setSelectedDays([]);
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDays([]);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: 12,
          padding: 24,
          width: "90%",
          maxWidth: 600,
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3>Gán ca hàng tháng</h3>
          <button className="small-button" onClick={onClose} type="button">
            <XCircle size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack-form">
          {/* Month selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 8 }}>
            <button className="small-button" onClick={prevMonth} type="button">
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 600, minWidth: 140, textAlign: "center", fontSize: 16 }}>
              Tháng {month}/{year}
            </span>
            <button className="small-button" onClick={nextMonth} type="button">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day selector grid */}
          <label>
            Chọn ngày trong tháng *
            <div style={{ marginTop: 8 }}>
              {/* Weekday headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--muted)", padding: "4px 0" }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {/* Empty cells for days before 1st */}
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {/* Day buttons */}
                {monthDays.map((day) => {
                  const past = isPastDay(day);
                  const weekend = isWeekend(day);
                  const selected = isDaySelected(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      disabled={past}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        borderRadius: 8,
                        border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                        background: selected
                          ? "var(--primary)"
                          : past
                          ? "var(--bg-secondary)"
                          : weekend
                          ? "rgba(239, 68, 68, 0.05)"
                          : "transparent",
                        color: selected
                          ? "white"
                          : past
                          ? "var(--muted)"
                          : weekend
                          ? "#ef4444"
                          : "inherit",
                        cursor: past ? "not-allowed" : "pointer",
                        fontSize: 13,
                        fontWeight: selected ? 600 : 400,
                        opacity: past ? 0.5 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        gap: 1,
                      }}
                    >
                      <span>{day}</span>
                      {weekend && !selected && <span style={{ fontSize: 8, color: "#ef4444" }}>T7/CN</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick select buttons */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" className="small-button" onClick={selectWeekdays} style={{ fontSize: 11 }}>
                Tất cả T2-T6
              </button>
              <button type="button" className="small-button" onClick={selectWeekends} style={{ fontSize: 11 }}>
                T7 + CN
              </button>
              <button type="button" className="small-button" onClick={selectAll} style={{ fontSize: 11 }}>
                Tất cả
              </button>
              <button type="button" className="small-button" onClick={clearAll} style={{ fontSize: 11 }}>
                Bỏ chọn
              </button>
            </div>
          </label>

          {/* Staff */}
          <label>
            Nhân viên *
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
              <option value="">— Chọn nhân viên —</option>
              {staffs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </label>

          {/* Shift type */}
          <label>
            Ca làm việc *
            <select value={shiftType} onChange={(e) => setShiftType(e.target.value as typeof shiftType)} required>
              {shiftTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} ({t.startTime} — {t.endTime})
                </option>
              ))}
            </select>
          </label>

          {/* Time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Giờ bắt đầu
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label>
              Giờ kết thúc
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>

          {/* Note */}
          <label>
            Ghi chú
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Áp dụng cho tháng..."
              rows={2}
            />
          </label>

          {/* Summary */}
          <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Tổng cộng:</strong> {selectedDays.length} ngày × 1 ca = <strong>{selectedDays.length} lịch</strong>
            </p>
          </div>

          <div className="inline-actions" style={{ marginTop: 8 }}>
            <button className="full-button" type="submit" disabled={isSubmitting || selectedDays.length === 0 || !staffId}>
              {isSubmitting ? "Đang lưu..." : `Gán ${selectedDays.length} ca`}
            </button>
            <button className="small-button" onClick={onClose} type="button">
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
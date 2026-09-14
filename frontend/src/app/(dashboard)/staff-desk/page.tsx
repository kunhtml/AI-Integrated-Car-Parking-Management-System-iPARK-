"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarX, ClipboardCheck, Loader2 } from "lucide-react";

import { RoleGuard } from "@/components/layout/role-guard";
import { useParkingApp } from "@/context/parking-app-context";
import { StaffDeskView } from "@/features/staff-desk/staff-desk-view";
import { apiFetch } from "@/lib/client-api";

// Mirror backend shift-schedules time math: shift day read in Asia/Ho_Chi_Minh,
// start/end built as VN wall-clock instants. Overnight shifts (end <= start)
// roll the end into the next day.
function shiftDateTime(dateVal: string | Date, time: string): number | null {
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return (
    Date.UTC(part("year"), part("month") - 1, part("day"), hour, minute) -
    7 * 60 * 60 * 1000
  );
}

function shiftEndAt(s: {
  date: string;
  startTime: string;
  endTime: string;
}): number | null {
  const start = shiftDateTime(s.date, s.startTime);
  let end = shiftDateTime(s.date, s.endTime);
  if (start === null || end === null) return null;
  if (end <= start) end += 24 * 60 * 60 * 1000;
  return end;
}

// end <= start on the raw wall-clock values → overnight shift.
function isOvernightShift(s: {
  date: string;
  startTime: string;
  endTime: string;
}): boolean {
  const start = shiftDateTime(s.date, s.startTime);
  const end = shiftDateTime(s.date, s.endTime);
  if (start === null || end === null) return false;
  return end <= start;
}

const shiftTypeLabel: Record<string, string> = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  evening: "Ca tối",
  night: "Ca đêm",
};

export default function StaffDeskPage() {
  const { currentUser, shiftScheduleList, checkInShift } = useParkingApp();
  const [status, setStatus] = useState<"loading" | "active" | "inactive">(
    "loading",
  );
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkCurrentShift = useCallback(async () => {
    try {
      const response = await apiFetch("/shift-schedules/my/current");
      const data = await response.json();
      setStatus(response.ok && data.active ? "active" : "inactive");
    } catch {
      setStatus("inactive");
    }
  }, []);

  useEffect(() => {
    void checkCurrentShift();
  }, [checkCurrentShift]);

  // Ca đang trong cửa sổ cho phép điểm danh (giống backend: từ
  // start - 30 phút, hoặc start - 12 giờ với ca xuyên đêm, đến lúc ca kết thúc).
  const pendingShifts = useMemo(() => {
    if (!currentUser) return [];
    const now = Date.now();
    return shiftScheduleList
      .filter((s) => {
        if (String(s.staffId) !== String(currentUser.id)) return false;
        if (s.status !== "scheduled") return false;
        const start = shiftDateTime(s.date, s.startTime);
        const end = shiftEndAt(s);
        if (start === null || end === null) return false;
        const earlyMs = (isOvernightShift(s) ? 12 * 60 : 30) * 60 * 1000;
        return now >= start - earlyMs && now < end;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [shiftScheduleList, currentUser]);

  async function handleCheckIn(scheduleId: string) {
    setCheckingInId(scheduleId);
    setError(null);
    try {
      await checkInShift(scheduleId);
      await checkCurrentShift();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không điểm danh ca được.",
      );
    } finally {
      setCheckingInId(null);
    }
  }

  return (
    <RoleGuard allowedRoles={["staff"]}>
      {status === "loading" ? (
        <div className="staff-desk-access-state" role="status">
          <Loader2 className="spin" size={28} />
          <p>Đang kiểm tra ca làm việc...</p>
        </div>
      ) : status === "active" ? (
        <StaffDeskView />
      ) : (
        <div
          className="staff-desk-access-state staff-desk-access-denied"
          role="alert"
        >
          <CalendarX size={34} />
          <h1>Bạn không có ca làm việc hiện tại</h1>
          <p>
            Camera và các thao tác tại cổng sẽ khả dụng khi bạn đã check-in một
            ca đang diễn ra.
          </p>

          {pendingShifts.length > 0 ? (
            <div className="staff-desk-attendance-list">
              <p className="staff-desk-attendance-title">
                Ca hôm nay chưa điểm danh
              </p>
              {pendingShifts.map((s) => (
                <div className="staff-desk-attendance-row" key={s.id}>
                  <div className="staff-desk-attendance-info">
                    <strong>
                      {shiftTypeLabel[s.shiftType] ?? "Ca làm việc"}
                    </strong>
                    <span>
                      {s.startTime} – {s.endTime}
                    </span>
                  </div>
                  <button
                    className="small-button primary"
                    type="button"
                    onClick={() => handleCheckIn(s.id)}
                    disabled={checkingInId !== null}
                  >
                    {checkingInId === s.id ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <ClipboardCheck size={14} />
                    )}
                    {checkingInId === s.id
                      ? "Đang điểm danh..."
                      : "Điểm danh ca làm việc"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="staff-desk-attendance-empty">
              Hôm nay bạn chưa được gắn ca. Liên hệ quản lý để được phân lịch.
            </p>
          )}

          {error && <p className="staff-desk-attendance-error">{error}</p>}
        </div>
      )}
    </RoleGuard>
  );
}

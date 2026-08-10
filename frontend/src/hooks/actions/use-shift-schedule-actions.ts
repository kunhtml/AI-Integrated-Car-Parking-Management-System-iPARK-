import { apiFetch } from "@/lib/client-api";
import type { ShiftScheduleItem, ShiftType, StaffForSchedule } from "@/types";

type ShiftScheduleActionsParams = {
  setScheduleList: (items: ShiftScheduleItem[] | ((items: ShiftScheduleItem[]) => ShiftScheduleItem[])) => void;
  setActionLog: (log: string) => void;
};

export function createShiftScheduleActions({
  setScheduleList,
  setActionLog,
}: ShiftScheduleActionsParams) {
  // Load schedules (for admin or staff)
  async function loadSchedules(params?: {
    staffId?: string;
    fromDate?: string;
    toDate?: string;
    month?: number;
    year?: number;
  }) {
    try {
      const searchParams = new URLSearchParams();
      if (params?.staffId) searchParams.set("staffId", params.staffId);
      if (params?.fromDate) searchParams.set("fromDate", params.fromDate);
      if (params?.toDate) searchParams.set("toDate", params.toDate);
      if (params?.month) searchParams.set("month", String(params.month));
      if (params?.year) searchParams.set("year", String(params.year));

      const queryString = searchParams.toString();
      const url = `/shift-schedules${queryString ? `?${queryString}` : ""}`;

      const response = await apiFetch(url);
      const data = await response.json();
      if (response.ok) {
        setScheduleList(data.schedules);
        return data.schedules as ShiftScheduleItem[];
      }
      setActionLog(data.message || "Không tải được lịch ca");
      return [];
    } catch {
      setActionLog("Lỗi kết nối khi tải lịch ca");
      return [];
    }
  }

  // Load my schedule (for staff)
  async function loadMySchedule(params?: {
    fromDate?: string;
    toDate?: string;
    month?: number;
    year?: number;
  }) {
    try {
      const searchParams = new URLSearchParams();
      if (params?.fromDate) searchParams.set("fromDate", params.fromDate);
      if (params?.toDate) searchParams.set("toDate", params.toDate);
      if (params?.month) searchParams.set("month", String(params.month));
      if (params?.year) searchParams.set("year", String(params.year));

      const queryString = searchParams.toString();
      const url = `/shift-schedules/my${queryString ? `?${queryString}` : ""}`;

      const response = await apiFetch(url);
      const data = await response.json();
      if (response.ok) {
        setScheduleList(data.schedules);
        return data.schedules as ShiftScheduleItem[];
      }
      setActionLog(data.message || "Không tải được lịch của bạn");
      return [];
    } catch {
      setActionLog("Lỗi kết nối khi tải lịch của bạn");
      return [];
    }
  }

  // Load weekly schedule
  async function loadWeeklySchedule(weekStart?: string, staffId?: string) {
    try {
      const searchParams = new URLSearchParams();
      if (weekStart) searchParams.set("weekStart", weekStart);
      if (staffId) searchParams.set("staffId", staffId);

      const queryString = searchParams.toString();
      const url = `/shift-schedules/week${queryString ? `?${queryString}` : ""}`;

      const response = await apiFetch(url);
      const data = await response.json();
      if (response.ok) {
        setScheduleList(data.schedules);
        return data.schedules as ShiftScheduleItem[];
      }
      setActionLog(data.message || "Không tải được lịch tuần");
      return [];
    } catch {
      setActionLog("Lỗi kết nối khi tải lịch tuần");
      return [];
    }
  }

  // Get shift types
  async function getShiftTypes(): Promise<ShiftType[]> {
    try {
      const response = await apiFetch("/shift-schedules/types");
      const data = await response.json();
      if (response.ok) {
        return data.shiftTypes;
      }
      return [];
    } catch {
      return [];
    }
  }

  // Get staff list (for admin)
  async function getStaffs(): Promise<StaffForSchedule[]> {
    try {
      const response = await apiFetch("/shift-schedules/staffs");
      const data = await response.json();
      if (response.ok) {
        return data.staffs;
      }
      return [];
    } catch {
      return [];
    }
  }

  // Create schedule
  async function createSchedule(data: {
    staffId: string;
    date: string;
    shiftType: "morning" | "afternoon" | "evening" | "night";
    startTime: string;
    endTime: string;
    note?: string;
    location?: string;
    deviceId?: string;
  }) {
    const response = await apiFetch("/shift-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (response.ok) {
      setScheduleList((items) => [result.schedule, ...items]);
      setActionLog("Đã gán lịch ca thành công");
      return result.schedule as ShiftScheduleItem;
    }
    setActionLog(result.message || "Không gán được lịch ca");
    throw new Error(result.message);
  }

  // Bulk create schedules
  async function bulkCreateSchedules(schedules: Array<{
    staffId: string;
    date: string;
    shiftType: "morning" | "afternoon" | "evening" | "night";
    startTime: string;
    endTime: string;
    note?: string;
    location?: string;
    deviceId?: string;
  }>) {
    const response = await apiFetch("/shift-schedules/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedules }),
    });
    const result = await response.json();
    if (response.ok) {
      setScheduleList((items) => [...result.schedules, ...items]);
      setActionLog(result.message || "Đã tạo lịch ca hàng loạt");
      return result.schedules as ShiftScheduleItem[];
    }
    setActionLog(result.message || "Không tạo được lịch ca");
    throw new Error(result.message);
  }

  // Update schedule
  async function updateSchedule(id: string, updates: Partial<{
    staffId: string;
    date: string;
    shiftType: "morning" | "afternoon" | "evening" | "night";
    startTime: string;
    endTime: string;
    status: "scheduled" | "checked_in" | "completed" | "cancelled";
    note?: string;
    location?: string;
    deviceId?: string;
  }>) {
    const response = await apiFetch(`/shift-schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const result = await response.json();
    if (response.ok) {
      setScheduleList((items) => items.map((item) => (item.id === id ? result.schedule : item)));
      setActionLog("Đã cập nhật lịch ca");
      return result.schedule as ShiftScheduleItem;
    }
    setActionLog(result.message || "Không cập nhật được lịch ca");
    throw new Error(result.message);
  }

  // Delete schedule
  async function deleteSchedule(id: string) {
    const response = await apiFetch(`/shift-schedules/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (response.ok) {
      setScheduleList((items) => items.filter((item) => item.id !== id));
      setActionLog("Đã xóa lịch ca");
      return true;
    }
    setActionLog(result.message || "Không xóa được lịch ca");
    return false;
  }

  // Check in to shift
  async function checkInShift(id: string) {
    const response = await apiFetch(`/shift-schedules/${id}/check-in`, {
      method: "POST",
    });
    const result = await response.json();
    if (response.ok) {
      setScheduleList((items) => items.map((item) => (item.id === id ? result.schedule : item)));
      setActionLog("Đã check-in ca làm thành công");
      return result.schedule as ShiftScheduleItem;
    }
    setActionLog(result.message || "Không check-in được");
    throw new Error(result.message);
  }

  // Complete shift
  async function completeShiftSchedule(id: string) {
    const response = await apiFetch(`/shift-schedules/${id}/complete`, {
      method: "POST",
    });
    const result = await response.json();
    if (response.ok) {
      setScheduleList((items) => items.map((item) => (item.id === id ? result.schedule : item)));
      setActionLog("Đã hoàn thành ca làm");
      return result.schedule as ShiftScheduleItem;
    }
    setActionLog(result.message || "Không hoàn thành được ca");
    throw new Error(result.message);
  }

  return {
    loadSchedules,
    loadMySchedule,
    loadWeeklySchedule,
    getShiftTypes,
    getStaffs,
    createSchedule,
    bulkCreateSchedules,
    updateSchedule,
    deleteSchedule,
    checkInShift,
    completeShiftSchedule,
  };
}

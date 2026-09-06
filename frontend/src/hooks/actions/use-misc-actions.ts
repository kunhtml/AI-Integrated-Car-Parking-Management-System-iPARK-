import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import type {
  NotificationItem,
  RegisteredVehicle,
  ShiftItem,
  ShiftScheduleItem,
} from "@/types";

type MiscActionsParams = {
  setNotificationList: (
    items:
      | NotificationItem[]
      | ((items: NotificationItem[]) => NotificationItem[]),
  ) => void;
  setShiftList: (
    items: ShiftItem[] | ((items: ShiftItem[]) => ShiftItem[]),
  ) => void;
  setRegisteredVehicles: (
    vehicles:
      | RegisteredVehicle[]
      | ((items: RegisteredVehicle[]) => RegisteredVehicle[]),
  ) => void;
  setActionLog: (log: string) => void;
};

export function createMiscActions({
  setNotificationList,
  setShiftList,
  setRegisteredVehicles,
  setActionLog,
}: MiscActionsParams) {
  function simulateAction(message: string) {
    setActionLog(message);
  }

  async function markNotificationRead(id: string) {
    const response = await apiFetch(`/notifications/${id}/read`, {
      method: "PATCH",
    });
    const data = await response.json();
    if (response.ok) {
      setNotificationList((items) =>
        items.map((item) => (item.id === id ? data.notification : item)),
      );
    }
  }

  async function startShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const response = await apiFetch("/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") || "Ca làm"),
        note: String(form.get("note") || ""),
      }),
    });
    const data = await response.json();
    if (response.ok) {
      setShiftList((items) => [data.shift, ...items]);
      setActionLog("Đã bắt đầu ca làm việc.");
      formEl.reset();
    }
  }

  async function endShift(id: string) {
    const response = await apiFetch(`/shifts/${id}/end`, { method: "PATCH" });
    const data = await response.json();
    if (response.ok) {
      setShiftList((items) =>
        items.map((item) => (item.id === id ? data.shift : item)),
      );
      setActionLog("Đã kết thúc ca làm việc.");
    }
  }

  async function approveVehicle(vehicle: RegisteredVehicle) {
    if (!vehicle.id) {
      simulateAction("Xe này chưa có ID MongoDB để duyệt.");
      return;
    }
    const response = await apiFetch(`/vehicles/${vehicle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: vehicle.id, status: "Đã đăng ký" }),
    });
    const data = await response.json();
    if (!response.ok) {
      simulateAction(data.message || "Không duyệt được phương tiện.");
      return;
    }
    setRegisteredVehicles((items) =>
      items.map((item) => (item.id === vehicle.id ? data.vehicle : item)),
    );
    simulateAction(`Đã duyệt xe ${vehicle.plate} trong MongoDB.`);
  }

  async function fetchVehicleDetail(
    id: string,
  ): Promise<RegisteredVehicle | null> {
    const response = await apiFetch(`/vehicles/${id}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.vehicle as RegisteredVehicle;
  }

  return {
    simulateAction,
    markNotificationRead,
    startShift,
    endShift,
    approveVehicle,
    fetchVehicleDetail,
  };
}

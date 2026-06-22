import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import type { FeedbackItem, IncidentItem, NotificationItem, RegisteredVehicle, ShiftItem } from "@/types";

type MiscActionsParams = {
  setFeedbackList: (items: FeedbackItem[] | ((items: FeedbackItem[]) => FeedbackItem[])) => void;
  setNotificationList: (items: NotificationItem[] | ((items: NotificationItem[]) => NotificationItem[])) => void;
  setShiftList: (items: ShiftItem[] | ((items: ShiftItem[]) => ShiftItem[])) => void;
  setIncidentList: (items: IncidentItem[] | ((items: IncidentItem[]) => IncidentItem[])) => void;
  setRegisteredVehicles: (vehicles: RegisteredVehicle[] | ((items: RegisteredVehicle[]) => RegisteredVehicle[])) => void;
  setActionLog: (log: string) => void;
};

export function createMiscActions({
  setFeedbackList,
  setNotificationList,
  setShiftList,
  setIncidentList,
  setRegisteredVehicles,
  setActionLog,
}: MiscActionsParams) {
  function simulateAction(message: string) {
    setActionLog(message);
  }

  async function createFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: String(form.get("subject") || ""),
        content: String(form.get("content") || ""),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setActionLog(data.message || "Không gửi được phản hồi.");
      return;
    }
    setFeedbackList((items) => [data.feedback, ...items]);
    setActionLog("Đã lưu phản hồi vào MongoDB.");
    event.currentTarget.reset();
  }

  async function updateFeedbackStatus(id: string) {
    const response = await apiFetch(`/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Đã phản hồi", response: "Đã tiếp nhận và xử lý." }),
    });
    const data = await response.json();
    if (response.ok) {
      setFeedbackList((items) => items.map((item) => (item.id === id ? data.feedback : item)));
      setActionLog("Đã phản hồi khách hàng.");
    }
  }

  async function markNotificationRead(id: string) {
    const response = await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
    const data = await response.json();
    if (response.ok) {
      setNotificationList((items) => items.map((item) => (item.id === id ? data.notification : item)));
    }
  }

  async function startShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(form.get("name") || "Ca làm"), note: String(form.get("note") || "") }),
    });
    const data = await response.json();
    if (response.ok) {
      setShiftList((items) => [data.shift, ...items]);
      setActionLog("Đã bắt đầu ca làm việc.");
      event.currentTarget.reset();
    }
  }

  async function endShift(id: string) {
    const response = await apiFetch(`/shifts/${id}/end`, { method: "PATCH" });
    const data = await response.json();
    if (response.ok) {
      setShiftList((items) => items.map((item) => (item.id === id ? data.shift : item)));
      setActionLog("Đã kết thúc ca làm việc.");
    }
  }

  async function createIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: String(form.get("type") || "Khác"),
        note: String(form.get("note") || ""),
        plate: String(form.get("plate") || ""),
      }),
    });
    const data = await response.json();
    if (response.ok) {
      setIncidentList((items) => [data.incident, ...items]);
      setActionLog("Đã lưu sự cố vào MongoDB.");
      event.currentTarget.reset();
    }
  }

  async function resolveIncident(id: string) {
    const response = await apiFetch(`/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Đã xử lý" }),
    });
    const data = await response.json();
    if (response.ok) {
      setIncidentList((items) => items.map((item) => (item.id === id ? data.incident : item)));
      setActionLog("Đã xử lý sự cố.");
    }
  }

  async function approveVehicle(vehicle: RegisteredVehicle) {
    if (!vehicle.id) {
      simulateAction("Xe này chưa có ID MongoDB để duyệt.");
      return;
    }
    const response = await apiFetch("/vehicles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: vehicle.id, status: "Đã đăng ký" }),
    });
    const data = await response.json();
    if (!response.ok) {
      simulateAction(data.message || "Không duyệt được phương tiện.");
      return;
    }
    setRegisteredVehicles((items) => items.map((item) => (item.id === vehicle.id ? data.vehicle : item)));
    simulateAction(`Đã duyệt xe ${vehicle.plate} trong MongoDB.`);
  }

  return {
    simulateAction,
    createFeedback,
    updateFeedbackStatus,
    markNotificationRead,
    startShift,
    endShift,
    createIncident,
    resolveIncident,
    approveVehicle,
  };
}
